# Nilamit Behavioral Flows: The Logic Engine

This document visualizes the mission-critical workflows of the Nilamit platform, using sequence diagrams to map interactions between the Client, Server Actions, Database, and Real-time Bus.

---

## 🔐 1. Authentication & Identity Flow
*How users enter the platform and how their persona is established.*

```mermaid
sequenceDiagram
    actor User
    participant FE as Frontend (AuthForm)
    participant AC as Auth.js (NextAuth)
    participant DB as PostgreSQL (Prisma)
    
    User->>FE: Enter Credentials / Google Sign-in
    FE->>AC: execute signIn()
    AC->>DB: Validate User / Create Record
    DB-->>AC: User Record Found
    AC->>DB: Augment JWT (reputation, phone_verify, level)
    AC-->>FE: JWT Session Created
    FE->>User: Redirect to Locale-Dashboard
```

---

## ⚡ 2. The Bidding Engine (High-Concurrency)
*The critical "Battle Flow" for securing an item.*

```mermaid
sequenceDiagram
    actor Bidder
    participant SA as placeBid (Server Action)
    participant TX as Prisma Transaction (FOR UPDATE)
    participant DB as PostgreSQL
    participant PS as Pusher Server
    
    Bidder->>SA: Submit Bid (৳Amount)
    SA->>TX: Start Serializable Transaction
    TX->>DB: SELECT auction FOR UPDATE (Lock Row)
    DB-->>TX: Auction Locked
    TX->>TX: Validate (Time, Status, Min Increment)
    TX->>DB: CREATE Bid record
    TX->>DB: UPDATE Auction currentPrice
    TX->>DB: Handle Anti-snipe (Extend Time?)
    TX->>TX: Scan proactive alerts (PRICES/OUTBIDS)
    TX->>DB: Commit Transaction
    SA->>PS: Broadcast "new-bid" to Presence Channel
    SA->>PS: Push "price-alert" to relevant Users
    PS-->>Bidder: Update UI via WebSocket
```

---

## 🏁 3. Auction Closing & Escrow Flow
*The "Liquidation" process once the clock hits zero.*

```mermaid
sequenceDiagram
    participant Sys as System / Cron / User
    participant CA as closeAuction Logic
    participant DB as PostgreSQL
    participant ESC as Escrow Shield
    participant RES as Resend (Email)
    
    Sys->>CA: Trigger Close (EndTime hit)
    CA->>DB: Find Highest Bidder
    CA->>CA: calculateSuccessFee() (v1.5 Tiers)
    CA->>DB: Update Auction -> SOLD
    CA->>ESC: Create EscrowTransaction (HELD if Verified)
    CA->>DB: Create Conversation record
    CA->>RES: Send "Congratulations" Email
    ESC-->>DB: Save transaction record
```

---

## 💬 4. Real-time Coordination Flow
*How buyer and seller coordinate post-sale safely.*

```mermaid
sequenceDiagram
    actor Buyer
    actor Seller
SA as chat.ts (Server Action)
    participant PII as PII Filter Utility
    participant DB as PostgreSQL
    participant PS as Pusher Server
    
    Buyer->>SA: Send Message + Image
    SA->>PII: checkContent() (Filter phone/critical info)
    PII-->>SA: Content Masked / Validated
    SA->>DB: SAVE Message (Conversation ID)
    SA->>PS: Trigger "NEW_MESSAGE" event
    PS-->>Seller: Real-time UI Update + Notification Sound
    Seller->>SA: Reply (Logistics Coordination)
```

---

## 🚨 5. Real-time Alert Flow (eBay Model)
*The proactive "Outbid" and "Target" system.*

```mermaid
graph LR
    Bid[New Bid Placed] --> Sync[Global State Update]
    Sync --> Match{Match Alerts?}
    Match -->|Hit Target| T[TARGET_REACHED Alert]
    Match -->|Surpassed| O[OUTBID Alert]
    T --> Deactivate[Mark Alert Inactive]
    Deactivate --> Push[Pusher Dispatch]
    O --> Push
    Push --> Client[Toast UI + Desktop Notice]
```
