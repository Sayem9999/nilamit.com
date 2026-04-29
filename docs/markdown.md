# 📄 Markdown Documentation Standards

> Last Updated: April 29, 2026

All `.md` files in the Nilamit project must follow these guidelines:

## 1. Visual Hierarchy
- Use single `#` for the main title.
- Use `##` for major sections and `###` for sub-components.
- Maintain a clear, logical flow (Summary -> Details -> Code -> Verification).

## 2. GitHub-Specific Enhancements
- Use **Alerts** for critical info:
  > [!IMPORTANT]
  > This is a critical rule.
- Use **Checklists** for progress tracking:
  - [x] Done
  - [ ] To do

## 3. Code Blocks
- Always specify the language: ` ```typescript `, ` ```bash `, ` ```Firestore `.
- Inline code like `const x = 5` should use single backticks.

## 4. Linking
- Use absolute paths for internal file links when viewed by an agent (e.g., `[file:///.../package.json]`).
- Use relative paths for user-facing documentation.

## 5. Metadata
- If possible, include a "Last Updated" timestamp or version number in the header for core documentation.
