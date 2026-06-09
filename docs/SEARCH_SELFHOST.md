# Typesense self-host runbook (GCP, Mumbai `asia-south1`)

Operational guide for running the search node yourself — the recommended
starting point for nilamit (see cost comparison in [SEARCH.md](./SEARCH.md)).
Single node, in-region for BD latency, snapshots to GCS nightly.

> The app talks to Typesense over plain REST, so everything here is swappable
> for Typesense Cloud later with **zero code change** — only `TYPESENSE_HOST` +
> `TYPESENSE_API_KEY` change.

---

## 1. Provision the VM

```bash
PROJECT=nilamit-52073
ZONE=asia-south1-a

gcloud compute instances create typesense-prod \
  --project=$PROJECT --zone=$ZONE \
  --machine-type=e2-small \
  --image-family=cos-stable --image-project=cos-cloud \
  --boot-disk-size=20GB \
  --create-disk=name=ts-data,size=20GB,type=pd-balanced,auto-delete=no \
  --tags=typesense
```

Mount the data disk once (Container-Optimized OS auto-formats via cloud-init,
or do it manually with `mkfs.ext4` + `/etc/fstab` → `/mnt/disks/ts-data`).

## 2. Generate a strong admin key + store it in Secret Manager

```bash
ADMIN_KEY=$(openssl rand -hex 32)

# App-side secret (the backend reads this):
printf '%s' "$ADMIN_KEY" | firebase apphosting:secrets:set TYPESENSE_API_KEY \
  --project nilamit-52073 --data-file -
firebase apphosting:secrets:grantaccess TYPESENSE_API_KEY \
  --project nilamit-52073 --backend nilamit

# Keep a copy for the systemd unit below (store securely; do NOT commit).
echo "$ADMIN_KEY"
```

## 3. Run Typesense as a managed container (systemd)

On COS, `docker` is preinstalled. Create `/etc/systemd/system/typesense.service`:

```ini
[Unit]
Description=Typesense search node
After=docker.service network-online.target
Requires=docker.service

[Service]
Restart=always
RestartSec=5
Environment=TS_API_KEY=__PASTE_ADMIN_KEY__
ExecStartPre=-/usr/bin/docker rm -f typesense
ExecStart=/usr/bin/docker run --rm --name typesense \
  -p 8108:8108 \
  -v /mnt/disks/ts-data:/data \
  typesense/typesense:27.1 \
  --data-dir /data --api-key=${TS_API_KEY} --enable-cors
ExecStop=/usr/bin/docker stop typesense

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now typesense
sudo systemctl status typesense
curl -s localhost:8108/health   # {"ok":true}
```

## 4. TLS + network exposure

Typesense speaks HTTP on 8108. **Do not expose 8108 to the public internet.**
Pick one:

- **Preferred (no public IP):** put the VM and App Hosting on the same VPC /
  Serverless VPC connector and point `TYPESENSE_HOST` at the VM's *internal* DNS.
  Keep the firewall closed to the internet (`--source-ranges` = your VPC only).
- **Public + TLS:** front it with an HTTPS Load Balancer (managed cert) or
  Caddy on the VM terminating TLS on 443 → 8108. Restrict ingress with a
  firewall rule allowing only the App Hosting egress range.

Firewall (internal-only example):
```bash
gcloud compute firewall-rules create typesense-internal \
  --project=$PROJECT --network=default --direction=INGRESS --action=ALLOW \
  --rules=tcp:8108 --source-ranges=10.0.0.0/8 --target-tags=typesense
```

## 5. Configure the app + backfill

In `apphosting.yaml`, uncomment the Typesense block and set the host:
```yaml
  - variable: TYPESENSE_HOST
    value: "10.x.x.x"            # internal IP/DNS, or LB hostname
  - variable: TYPESENSE_API_KEY
    secret: TYPESENSE_API_KEY
  - variable: TYPESENSE_PORT
    value: "8108"               # or "443" behind a TLS LB
```
Deploy, then seed the index:
```bash
TYPESENSE_HOST=... TYPESENSE_PORT=8108 TYPESENSE_API_KEY=$ADMIN_KEY \
  npx tsx scripts/backfill-search.ts
```

## 6. Nightly snapshot to GCS

Typesense snapshots its data dir on demand. Cron it + sync to the backup bucket.
On the VM, `/etc/cron.daily/typesense-snapshot`:

```bash
#!/usr/bin/env bash
set -euo pipefail
KEY=__PASTE_ADMIN_KEY__
STAMP=$(date -u +%Y%m%d)
curl -s "localhost:8108/operations/snapshot?snapshot_path=/data/snap-$STAMP" \
  -H "X-TYPESENSE-API-KEY: $KEY"
gsutil -m rsync -r "/mnt/disks/ts-data/snap-$STAMP" \
  "gs://nilamit-52073-backups/typesense/$STAMP/"
find /mnt/disks/ts-data -maxdepth 1 -name 'snap-*' -mtime +3 -exec rm -rf {} +
```
`chmod +x` it. (Reuses the existing `nilamit-52073-backups` bucket; its 30-day
lifecycle GCs old snapshots automatically.)

**Recovery:** the index is fully rebuildable from Firestore at any time via
`scripts/backfill-search.ts` — snapshots only save re-index time, they're not
the source of truth. A total loss = re-run the backfill.

## 7. Monitoring

`/api/health` now reports `search: "ok" | "error" | "disabled"`. Point an uptime
check at it and **alert on `search:"error"`** (the node is down — search has
fallen back to the in-memory scan, so it's degraded, not an outage). `disabled`
is expected until provisioned.

## Upgrades

Bump the image tag in the systemd unit (`typesense/typesense:<newer>`),
`systemctl restart typesense`. Data dir is version-forward-compatible within a
major; read Typesense release notes for major bumps. Take a snapshot first.
