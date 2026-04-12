# 🗓️ Nilamit Project Plan

## Current Milestone: v1.5 Hardening & Social Expansion
**Status**: In Progress 🏗️

### High Priority (Immediate)
- [ ] **Real-time Bid Refresh**: Transition from 5s polling to Pusher-based event streaming for auction prices.
- [ ] **Payment Integration**: Implement bKash/Nagad sandbox for escrow-style bid deposits.
- [ ] **Advanced Moderation**: Automated flagging of suspicious bidding patterns (shill bidding detection).

### Social & Reputational
- [ ] **Auction Circles**: Allow users to create private groups for localized/exclusive auctions.
- [ ] **Reputation Scores**: Weighted user ratings based on successful transaction closures.
- [ ] **Verified Status**: Tiered badge system for sellers (Phone -> Email -> Business).

### Mobile & UX
- [ ] **PWA Support**: Offline browsing of watched auctions and push notifications for outbid alerts.
- [ ] **Bangla Localization (বাংলা)**: Comprehensive translation of the UI for non-technical users in rural regions.
- [ ] **Image Optimization**: Auto-resize and compression for bulk-uploaded images to save bandwidth.

## Completed Milestones
- [x] **v1.3**: Admin Tabs (Moderation, System, Users) fully functional.
- [x] **v1.2**: Bulk image upload and auction reporting system.
- [x] **v1.1**: SMS-based trust anchors and basic bidding logic.

## Strategy
1. **Trust First**: Every feature must reinforce buyer/seller confidence (Phone verification, server-side anti-sniping).
2. **Speed & Efficiency**: Aggressive polling management and local caching.
3. **Bangladesh Context**: Prioritize mobile-first and low-bandwidth optimizations.
