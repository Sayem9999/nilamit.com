# Nilamit Behavioral Flows: The Logic Engine

> Last Updated: April 29, 2026

This document visualizes the mission-critical workflows of the Nilamit platform, using sequence diagrams to map interactions between the Client, Server Actions, Database, and Real-time Bus.

---

## 🔐 1. Authentication & Identity Flow
*How users enter the platform and how their identity is verified.*

```mermaid
sequenceDiagram
    actor User
    participant FE as Frontend (AuthForm)
    participant SA as Server Actions (sendOTP/verify)
    participant AC as Auth.js (NextAuth)
    participant DB as NoSQL (Firestore)
    
    User->>FE: Enter Identity (Phone/Email)
    FE->>SA: requestOTP(email)
    SA->>User: SMS/Email OTP Dispatch
    User->>FE: Enter OTP
    FE->>SA: verifyOTP(code)
    SA-->>FE: Verified -> Proceed to Profile
    FE->>AC: execute signIn()
    AC->>DB: Validate / Create Record
    DB-->>AC: User Record Created/Found
    AC->>DB: Augment JWT (reputation, verify_status)
    AC-->>FE: JWT Session Created
    FE->>User: Redirect to Locale-Dashboard (Gated)
```

> [!NOTE]
> All high-value actions (Bidding, Selling) check the session's `verify_status` via the `VerificationGuard` before execution.

---

## ⚡ 2. The Bidding Engine (High-Concurrency)
*The critical "Battle Flow" for securing an item.*

```mermaid
sequenceDiagram
    actor Bidder
    participant SA as placeBid (Server Action)
    participant TX as Firestore Transaction (FOR UPDATE)
    participant DB as NoSQL
    participant PS as Firebase RTDB Server
    
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
    participant DB as NoSQL
    participant ESC as Escrow Shield
    participant Mail as Firebase Trigger Email (SMTP)
    
    Sys->>CA: Trigger Close (EndTime hit)
    CA->>DB: Find Highest Bidder
    CA->>CA: calculateSuccessFee() (v1.5 Tiers)
    CA->>DB: Update Auction -> SOLD
    CA->>ESC: Create EscrowTransaction (HELD if Verified)
    CA->>DB: Create Conversation record
    CA->>Mail: Send "Congratulations" Email (via mail collection)
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
    participant DB as NoSQL
    participant PS as Firebase RTDB Server
    
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
    Deactivate --> Push[Firebase RTDB Dispatch]
    O --> Push
    Push --> Client[Toast UI + Desktop Notice]
```
