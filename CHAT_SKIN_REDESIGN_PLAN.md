### Chat Interface Skin Redesign Plan — Educational Clarity (Presentation-Only)

This plan transitions the chat UI from consumer chat bubbles to an educational, document-like reading experience for assistant responses, while keeping user messages distinct and preserving all current functionality (messages, new chat, voice input, system prompts). No backend/API changes.

---

### Objectives

- Emphasize educational clarity for long, structured assistant outputs: paragraphs, headings, lists, code, tables, and math.
- Keep user messages visually distinct, concise, and aligned right.
- Retain feature parity (message flow, voice mode, new chat, settings/history, system prompts), with presentation-only changes.
- Maintain subtle brand differentiation (purple accent lineage) without cloning other apps.

---

### Architectural Overview (Current)

- Rendering pipeline
  - `frontend/src/components/ChatInterface.tsx` orchestrates layout, header, history drawer, voice mode, messages list, and input.
  - `frontend/src/components/ChatMessages/ChatMessages.tsx` renders the list and determines `user` vs `assistant` classes.
  - `frontend/src/components/FormattedMessage/FormattedMessage.tsx` renders content (markdown/GFM, code highlighting) with styles in `FormattedMessage.css`.
  - Global container background and font family in `frontend/src/components/ChatInterface.css`.
  - Input, header, and voice mode controls in their respective components.

---

### Step 1 — Modify Where AI vs. User Messages Are Rendered

- Files to update
  - `frontend/src/components/ChatMessages/ChatMessages.tsx`
  - `frontend/src/components/ChatMessages/ChatMessages.css`
  - `frontend/src/components/FormattedMessage/FormattedMessage.tsx`
  - `frontend/src/components/FormattedMessage/FormattedMessage.css`

- Planned edits
  - Keep the existing message shape and `sender` logic intact.
  - Replace bubble styling for assistant messages with a flowing, document-like block:
    - Introduce container classes: `assistant-block`, `assistant-block__meta`, `assistant-block__content`.
    - For now, preserve `.assistant-message` in DOM (for safety) but layer new classes to avoid regressions.
  - Keep user messages compact, right-aligned chips:
    - Container classes: `user-chip`, `user-chip__content`, optional `user-chip__meta`.
  - Timestamp placement
    - Assistant: subtle left-aligned under content.
    - User: subtle right-aligned under chip.
  - Loading/typing indicator remains but aligns with assistant block styles.

---

### Step 2 — Introduce/Refactor Structural Components

- New lightweight presentation components (optional, to keep `ChatMessages.tsx` lean):
  - `frontend/src/components/ChatMessages/AssistantBlock.tsx`
    - Props: `{ content: string; timestamp: Date; }`
    - Renders `FormattedMessage` and a meta row.
  - `frontend/src/components/ChatMessages/UserChip.tsx`
    - Props: `{ content: string; timestamp: Date; }`
    - Compact right-aligned bubble/chip.
  - `frontend/src/components/ChatMessages/MessageMeta.tsx`
    - Shared small timestamp line; accessible time format.
  - Note: If we prefer fewer components, keep all logic in `ChatMessages.tsx` and just add CSS classes.

- `FormattedMessage` refinements (no breaking changes):
  - Add an optional `variant` prop: `'default' | 'lecture'`.
    - `'lecture'` applies typographic spacing tuned for long-form content.
  - Keep default behavior for user messages.

---

### Step 3 — Typography and Spacing for Readability

- Define tokens (in `frontend/src/styles/shared.css` or a new `styles/tokens.css` consumed by all components):
  - Fonts
    - `--font-sans`: system UI stack already used; keep.
    - `--font-mono`: `ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace`.
  - Type scale (light mode first)
    - Base: 16px; line-height: 1.65 for body text.
    - Headings in `FormattedMessage.css`:
      - h1: 1.55rem; h2: 1.35rem; h3: 1.15rem; balanced spacing (mt 1.6rem, mb 0.8rem).
    - Paragraphs: margin 0 0 1rem; longer max-width (see below).
  - Content width
    - Limit assistant blocks to `max-width: 780px` for readability; center them within the scroll column.
  - Lists
    - Comfortable indent; `li` spacing 0.35rem; nested list spacing 0.5rem.
  - Code
    - Keep current Prism styling; ensure `overflow-x: auto` and `font-size: 0.95rem`.
  - Tables
    - Preserve current table wrapper; ensure zebra stripes subtle.
  - Math (optional enhancement)
    - Plan to add math plugins later: `remark-math` + `rehype-katex` with KaTeX CSS; ensure lazy-loading or route-level splitting to avoid bloat.

---

### Step 4 — Color Palette for Educational Clarity

- Introduce CSS variables (tokens) applied app-wide:
  - `--bg-app: #F7F8FA`
  - `--surface: #FFFFFF`
  - `--text-primary: #0F172A`
  - `--text-secondary: #475569`
  - `--border-subtle: #E6E8EE`
  - `--brand-accent: #675CE9` (keeps lineage to current purple)
  - `--brand-accent-strong: #5B4EE8`
  - `--user-chip-bg: #E9F2FF`
  - `--link: var(--brand-accent-strong)`
  - `--inline-code-bg: #F1F3F8`

- Apply tokens:
  - `frontend/src/components/ChatInterface.css`
    - Replace gradient background with `background: var(--bg-app);` on `.chat-container`.
  - `ChatMessages.css`
    - Assistant block: `background: var(--surface); border: 1px solid var(--border-subtle); color: var(--text-primary);`
    - User chip: `background: var(--user-chip-bg); color: var(--text-primary);`
  - `FormattedMessage.css`
    - Link color to `--link`; blockquote border-left to `--brand-accent`.
  - Keep subtle brand via accent color in headings underline, callout bars, and links—not in full backgrounds.

- Dark mode (deferred; optional):
  - Add `:root[data-theme="dark"]` tokens now without wiring the toggle:
    - `--bg-app: #0B1020; --surface: #121933; --text-primary: #E6EDF7; --text-secondary: #9FB0C7; --border-subtle: #273050; --user-chip-bg: #1A2A4A; --inline-code-bg: #1B2442;`
  - Defer any code to switch themes until later.

---

### Step 5 — System/UI Elements Alignment

- `frontend/src/components/ChatHeader/ChatHeader.tsx` and `ChatHeader.css`
  - Keep structure and actions; update styles to use tokens.
  - Make header a flat surface with clear typography, no gradients. Optional subtle bottom border `var(--border-subtle)`.
  - Keep "New Chat" as a primary button with brand accent background and white text.

- `frontend/src/components/ChatInput/ChatInput.tsx` and `ChatInput.css`
  - Maintain current functionality; visually align to tokens.
  - Input field as elevated surface on light background, rounded corners, clear focus ring using `--brand-accent`.
  - Keep mic and send buttons; ensure clear affordance and accessible labels.

- `frontend/src/components/VoiceMode/*`
  - Adopt tokens for colors; keep behavior unchanged.
  - Make sure labels and state indicators have adequate contrast in light mode.

- `SettingsPanel`, `HistoryDrawer`
  - Swap gradient accents for token-based surfaces/borders; ensure consistent typography and spacing.

---

### Step 6 — Preserve Backend Compatibility

- No changes to `useChat` API usage or backend requests. Keep message objects unmodified:
  - `sender` remains `'user' | 'assistant'` and is the only criterion for presentation.
- Keep all endpoints and payloads unchanged; this is strictly a styling/structure layer update.
- Any new UI affordances (copy message, jump links) operate purely on client state/content.

---

### Step 7 — Risks and Mitigations

- Performance with long messages
  - Risk: heavy DOM for large markdown; Mitigation: keep simple DOM structure; consider list virtualization later if needed.
- Markdown security
  - Risk: rendering raw HTML; Mitigation: do not enable raw HTML; keep current `react-markdown` safe defaults.
- Code block overflow
  - Risk: horizontal scroll affects layout; Mitigation: enforce `overflow-x: auto` and max-width.
- Contrast/accessibility
  - Risk: low contrast with light tints; Mitigation: verify WCAG AA for text and controls.
- CSS regressions
  - Risk: broad selector changes; Mitigation: preserve existing class names and add new, more specific classes; migrate gradually.
- Asset bloat (math)
  - Risk: KaTeX CSS size; Mitigation: defer math until needed, lazy-load assets.
- Scroll anchoring and autoscroll
  - Risk: different block heights; Mitigation: keep the existing `messagesEndRef` behavior and test with long content.

---

### File-by-File Edit Plan

- `frontend/src/components/ChatInterface.css`
  - Replace gradient background with `var(--bg-app)`.
  - Ensure container font inherits from tokens.

- `frontend/src/styles/shared.css` (or new `styles/tokens.css`)
  - Add color and typography variables listed above; import where needed.

- `frontend/src/components/ChatMessages/ChatMessages.tsx`
  - Option A (minimal surface change): Keep current markup but add conditional classnames to wrap assistant messages with `assistant-block` and user messages with `user-chip` wrappers.
  - Option B (cleaner): Extract `AssistantBlock` and `UserChip` components and use them inside the `.map`.

- `frontend/src/components/ChatMessages/ChatMessages.css`
  - Deprecate bubble look for assistant; add styles for `assistant-block` (surface card) and `user-chip` (compact tag-like bubble).
  - Keep `.user-message`/`.assistant-message` temporarily for backward compatibility.

- `frontend/src/components/FormattedMessage/FormattedMessage.tsx`
  - Add `variant` prop with `'lecture'` default for assistant; keep default for user.
  - No change to content conversion logic.

- `frontend/src/components/FormattedMessage/FormattedMessage.css`
  - Adjust heading sizes and spacing; increase paragraph line-height.
  - Use new tokens for link colors, blockquote accent, table chrome, inline code background.
  - Constrain content width by applying a wrapper class used in assistant blocks.

- `frontend/src/components/ChatHeader/ChatHeader.css`, `frontend/src/components/ChatInput/ChatInput.css`, `frontend/src/components/VoiceMode/*.css`, `frontend/src/components/HistoryDrawer/HistoryDrawer.css`, `frontend/src/components/SettingsPanel.css`
  - Replace hard-coded colors/gradients with tokens; unify spacing and focus states.

---

### Subtle Brand Differentiation

- Keep the signature purple as an accent, not a background.
- Add a thin accent line or dot before assistant h2 headings using `--brand-accent`.
- Use a gentle, unique list bullet style (e.g., custom pseudo-element color) for top-level lists in assistant blocks.
- Maintain a compact user chip with a soft shadow and slight purple-tinted border to echo the brand.

---

### Rollout and QA Checklist

- Implementation guarded by a container class `lecture-skin` on `.chat-container` (easy rollback). Default it on, but keeping a single toggle class simplifies A/B.
- Cross-browser and responsive checks: narrow phones, tablets, desktop.
- Accessibility: keyboard focus, screen reader labels for controls, color contrast.
- Long-response tests: 2–5k words, multiple headings/lists/tables/code blocks.
- Voice mode: verify states, cooldown, and recording indicators remain visible and readable.
- Regression checks on history drawer, settings, and auth header.

---

### Acceptance Criteria

- Assistant messages render as readable, document-like blocks with constrained width and clear hierarchy.
- User messages remain visually distinct and right-aligned chips.
- Palette transitions to tokenized light theme; gradients removed from surfaces.
- No changes to backend API contracts or message flow.
- All existing features (voice input/output, new chat, history, settings) behave identically to before.


