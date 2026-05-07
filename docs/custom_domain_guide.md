# Custom Domain Setup Guide: nilamit.com (Namecheap → Firebase App Hosting)

Congratulations on purchasing **nilamit.com**! 

To connect your newly purchased Namecheap domain to your production application hosted on Firebase App Hosting (`nilamit-52073`), you must perform a brief DNS handshake. This guide walks you through the step-by-step configuration, highlighting common Namecheap pitfalls and troubleshooting methods.

---

## 📅 Prerequisites

1. Access to your **[Namecheap Dashboard](https://ap.www.namecheap.com/)**.
2. Access to your **[Firebase Console](https://console.firebase.google.com/)** for the project `nilamit-52073`.

---

## 🛠️ Step 1: Initiate Custom Domain Setup in Firebase Console

1. Open the [Firebase Console](https://console.firebase.google.com/) and select your project: **`nilamit-52073`**.
2. From the left sidebar, navigate to **Build** > **Hosting** (or **Hosting & Serverless** > **App Hosting** depending on your dashboard structure).
3. Find your core production deployment (`nilamit` backend or the primary deployment site).
4. Go to the **Settings** tab.
5. In the **Custom domains** section, click **Add custom domain**.
6. Enter your domain: `nilamit.com`.
7. **Recommended Option:** Ensure **"Redirect nilamit.com to www.nilamit.com"** (or vice versa) is configured based on your preference so both paths resolve to the same landing page.
8. Firebase will calculate your configurations and display **DNS TXT and A records**. Keep this tab open.

---

## 🌐 Step 2: Configure Namecheap Advanced DNS

1. Log in to your [Namecheap Account](https://ap.www.namecheap.com/).
2. In the sidebar, select **Domain List**.
3. Locate `nilamit.com` and click the **Manage** button on the far right.
4. From the top tabs, select **Advanced DNS**.

> [!CAUTION]
> ### 🛑 CRITICAL NAMECHEAP GOTCHA — MUST DO FIRST
> By default, Namecheap places a **"URL Redirect Record"** and a **"CNAME Record"** pointing to their parking page on all newly registered domains. 
> * You **must delete** any existing records of type **`URL Redirect Record`** or parking records. 
> * If left intact, these default records will conflict with your new IP addresses, causing SSL generation to fail and preventing your site from loading.

---

## ✏️ Step 3: Add Your Firebase DNS Records

Firebase will supply either a **TXT** ownership verification record or direct **A** records. Fill them out inside Namecheap's **Advanced DNS** table by clicking **Add New Record**:

### A. If Firebase asks for Domain Ownership Verification (TXT Record)
*   **Type:** `TXT Record`
*   **Host:** `@` *(represents the root domain `nilamit.com`)*
*   **Value:** `google-site-verification=...` *(paste the exact value shown in the Firebase Console)*
*   **TTL:** `Automatic` or `5 min` (choose the lowest available to speed up verification)

### B. Add Firebase Global Load Balancer IPs (A Records)
Firebase Routing runs behind dual-IP global load balancers for high availability. Add **two separate A records** for the root domain `@`, and configure the `www` subdomain:

#### 1. First Root Record
*   **Type:** `A Record`
*   **Host:** `@`
*   **Value:** *[First IP Address from Firebase Console, e.g., `199.36.158.100`]*
*   **TTL:** `Automatic`

#### 2. Second Root Record
*   **Type:** `A Record`
*   **Host:** `@`
*   **Value:** *[Second IP Address from Firebase Console, e.g., `199.36.158.100`]*
*   **TTL:** `Automatic`

#### 3. Subdomain Configuration (`www`)
To make sure `www.nilamit.com` works perfectly alongside the root domain:
*   **Type:** `CNAME Record` *(or A Record pointing to the same load balancer IPs)*
*   **Host:** `www`
*   **Value:** `nilamit.com.` *(include the trailing dot if Namecheap demands it, or standard `nilamit.com`)*
*   **TTL:** `Automatic`

---

## ⏳ Step 4: Verification and Automated SSL Issuance

1. After adding your records in Namecheap, click **Save All Changes**.
2. Go back to your Firebase Console tab and click **Verify** or **Finish**.
3. **DNS Propagation:** DNS records are distributed globally across name servers. This transition usually completes within 5–15 minutes, but can sometimes take up to a few hours depending on Namecheap TTL cache settings.
4. **Free SSL Provisioning:** Once Firebase verifies that your DNS points to its load balancer, it will **automatically generate a free Let's Encrypt SSL certificate** for `nilamit.com`.
   * *Status will transition from **"Pending"** to **"Active"**.*
   - This automatic SSL assignment is completely managed; you do not need to purchase or upload any certificate files yourself.

---

## 🔍 How to Troubleshoot DNS Propagation

If your domain is not online after 30 minutes, you can verify your active records externally without guessing:

1. Open the [Google Admin Toolbox Dig](https://toolbox.googleapps.com/apps/dig/).
2. Type in `nilamit.com` and select **A**.
3. Check if the returned IP addresses match the exact IP values provided in your Firebase Console.
4. Type in `nilamit.com` and select **TXT** to confirm your ownership verification records have propagated.

Once the DNS verification is green in your Firebase Console dashboard, the SSL certificate will apply, and your users in Bangladesh will be able to securely trade and bid on `https://nilamit.com`!
