# 🛠️ Nilamit Agent Skills

This document defines the specialized "skills" and patterns required for an AI agent to build effectively in the Nilamit codebase.

## 1. Atomic Bidding Logic
When writing bid handlers:
- Use `db.$transaction()`
- Include a `SELECT ... FOR UPDATE` query to lock the auction row.
- Verify the bid is higher than the `currentPrice + increment` before committing.

## 2. Localization & CSS
- Apply `.bn` utility class for Bengali text blocks.
- Use `src/lib/translations` (if implemented) for multi-language support.
- Ensure all interactive buttons have clear, low-technicality Bengali labels for rural accessibility.

## 3. UI/UX Aesthetics
- Use the **StarMap** pattern for social visualizations.
- Implement **Glassmorphism** for cards using `background-blur` and semi-transparent borders.
- Leverage **Framer Motion** for smooth entrances of new bid notifications.

## 4. Troubleshooting
- Check `src/lib/auth.ts` for persona management (ADMIN, SELLER, BIDDER).
- Ensure `useMutation` hooks (or Server Actions) have proper error handling that surfaces user-friendly messages.

## 5. Deployment
- Use `pnpm build` locally before pushing to verify type safety.
- Check `.env` for the required `SUPABASE_PRIVATE_KEY` and `DATABASE_URL`.
