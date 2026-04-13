# Transaction & Asset Custody Model

This document outlines the financial nodes and custody logic for the Nilamit marketplace, specifically tailored for the Bangladesh context (Cash on Delivery + MFS).

## 1. Financial Nodes

### A. Nilamit Operations Account (Platform Custody)
The marketplace acts as a trusted middleman for specific "trust-gating" funds. Any amount sent to Nilamit through MFS (bKash/Nagad) is held here.
- **Bid Deposits**: ৳250 held during "Elite" auctions (৳100,000+). Loser deposits are released automatically.
- **Escrow Coordination Fee**: A small advance held after an auction is won to "unlock" seller contact details.
- **Platform Commissions**: The success fee (default 5%) deducted from the coordination fee or settled separately.

### B. Buyer-Seller Direct Settlement (Off-Platform)
- **Primary Payment**: The vast majority of the "Final Bid Price" is settled directly between the buyer and seller.
- **Settlement Method**: Primarily **Cash on Delivery (COD)** upon physical inspection.
- **MFS Coordination**: Direct bKash/Nagad transfer from the winner's wallet to the seller's wallet.

---

## 2. Transaction Lifecycle

| Step | Action | Fund Movement | Custodian |
|:---|:---|:---|:---|
| **1. Bidding** | High-Value Bid Placement | Bidder pays ৳250 | **Nilamit** |
| **2. Close** | Auction Ends | Loser deposits released | **User Wallets** |
| **3. Win** | Winner Coordination | Winner pays Advance Fee | **Nilamit** |
| **4. Reveal** | Info Unlocked | Seller details shared | **Info Node** |
| **5. Delivery** | Logistics / COD | Final Price paid by Buyer | **Direct Settlement** |
| **6. Release** | Transaction Finalized | Escrow Advance finalized | **Nilamit** |

---

## 3. Database Mapping

- **BidDeposit Table**: Tracks the `status` (`held`, `released`, `forfeited`) of auction entry fees.
- **EscrowTransaction Table**: Holds the `amount` and `status` (`PENDING`, `HELD`, `RELEASED`) of the coordination advance.
- **User MFS Linkage**: `bkashNumber` and `nagadNumber` on the `User` model facilitate external direct settlement between parties.

---

## 4. Refund & Dispute Policies

- **Auto-Refund**: If a seller fails to ship, Nilamit refunds the Escrow Advance from the Operations Account.
- **Dispute Resolution**: If a buyer claims "Item Not as Described," the Escrow Advance is frozen (`DISPUTED`) until a moderator reviews the evidence.
- **Direct Loss**: Since final payment is COD, the buyer's primary risk (the full item cost) is mitigated by the physical inspection requirement.
