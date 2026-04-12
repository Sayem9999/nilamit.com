# 🛠 Nilamit API Documentation

Nilamit utilizes Next.js **Server Actions** as the primary interaction layer, complemented by **Cron API Routes** for scheduled tasks and **Pusher** for real-time events.

## 1. Server Actions (Data Layer)

### `auction.ts`
| Action | Description |
|---|---|
| `getAuction(id)` | Fetches single auction with seller and bid history. |
| `getAuctions(filters)` | Core search/filter engine for auction listings. |
| `createAuction(input)` | Validates and creates a new auction listing. |
| `getSpecializedFeeds()` | Returns homepage clusters (Ending Soon, Activity). |

### `bid.ts`
| Action | Description |
|---|---|
| `placeBid(id, amount)` | **High Integrity**: Uses Serializable DB transactions and SELECT FOR UPDATE to handle concurrent bids. Triggers Anti-snipe logic and Pusher events. |

### `admin-users.ts`
| Action | Description |
|---|---|
| `grantVerifiedSeller(id)` | Admin-only. Sets `isVerifiedSeller` to true. |
| `getAdminUsers()` | Fetches paged list of users with engagement metrics. |

### `alert.ts`
| Action | Description |
|---|---|
| `createAlert(data)` | Configures OUTBID or ENDING_SOON alerts for a user. |

---

## 2. Cron & API Endpoints

### `GET /api/cron/close-auctions`
- **Schedule**: Every 1 minute.
- **Task**: Finds auctions where `endTime <= now && status == 'ACTIVE'`. Resolves winners and transitions status to `CLOSED`.

### `GET /api/cron/closing-soon`
- **Schedule**: Every 15-30 minutes.
- **Task**: Scans watchlists and alerts. Fires both Resend emails and **Pusher** `ending-soon` events to active users.

---

## 3. Real-time Events (Pusher)

### `user-{userId}` (Private)
| Event | Payload | Description |
|---|---|---|
| `outbid-alert` | `auctionTitle`, `amount` | Fired when the user is no longer the high bidder. |
| `ending-soon` | `auctionId`, `auctionTitle` | Fired ~30 mins before a watched item closes. |

### `presence-auction-{auctionId}` (Public/Presence)
| Event | Payload | Description |
|---|---|---|
| `new-bid` | `amount`, `bidderName` | Updates the live price and bidder list in the UI. |

### `global-ticker` (Public)
| Event | Payload | Description |
|---|---|---|
| `new-activity` | `summary` | Drives the homepage live activity feed. |

---

## 4. Middleware & Edge Runtime
- **Prisma Proxy**: All server actions utilize a dynamic Prisma Proxy to ensure the heavy Prisma engine is not bundled into Edge functions (like authentication middleware), preventing 500 crashes.
