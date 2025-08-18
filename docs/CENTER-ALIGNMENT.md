### Center-Aligned Chat Layout Redesign Plan

This plan outlines how to move from left/right SMS-style alignment to a shared, center-aligned column while preserving all existing features and backend compatibility.

---

### 1) Where message alignment is currently controlled

- **Structure**
  - `frontend/src/components/ChatMessages/ChatMessages.tsx`
    - Wraps each turn with a container `div.message` and a role-based class: `user-message` or `assistant-message`.
    - Renders `AssistantBlock` for assistant turns and `UserChip` for user turns.
  - `frontend/src/components/ChatInterface.tsx`
    - Places `<ChatMessages />` between header and input; controls page-level container `div.chat-container`.

- **Styling**
  - `frontend/src/components/ChatMessages/ChatMessages.css`
    - `.messages-container` is a flex column with vertical scroll and spacing.
    - Alignment logic is here:
      - `.user-message { align-self: flex-end; }`
      - `.assistant-message { align-self: flex-start; }`
    - Bubble-era styles (`.message`, `.message-content`) and the newer skin styles (`.assistant-block`, `.user-chip`) coexist. Alignment still relies on `align-self` at the `.message` wrapper level.
  - `frontend/src/components/ChatMessages/AssistantBlock.tsx` and `UserChip.tsx`
    - Apply role-specific presentation; newer skin classes: `.assistant-block`, `.user-chip`.
  - `frontend/src/components/FormattedMessage/FormattedMessage.tsx`
    - Handles markdown rendering and is used inside both assistant and user blocks.

---

### 2) Restructure to render both roles in a single center column

- **Introduce a central column container** inside the scrolling message area:
  - Add a wrapper (e.g., `messages-column`) inside `.messages-container` that:
    - Centers horizontally (`margin: 0 auto`).
    - Constrains width via existing token `--content-max-width` (already used by `.assistant-block`).
    - Provides the vertical rhythm for all message items.

- **Normalize per-message wrappers**:
  - Remove left/right positioning by eliminating reliance on `.user-message`/`.assistant-message` `align-self` rules.
  - Keep a single flow where each `.message` occupies full column width and its inner content (assistant/user) sits within that centered column.

- **Preserve component boundaries**:
  - Keep `AssistantBlock` and `UserChip` as-is structurally; only adjust their container alignment and widths to be governed by the central column.
  - Ensure `messagesEndRef` remains at the very bottom of the new column to preserve auto-scroll behavior.

---

### 3) Visual differentiation guidelines in a centered format

- **Assistant messages (primary reading flow)**
  - Typography-forward, minimal chrome: plain background (transparent) with strong text color `var(--text-primary)`.
  - Rich content (headings, lists, code) continues to render via `FormattedMessage`.
  - Optional subtle affordance: a faint `border-left` accent or slim rule to guide the eye without boxing the content.

- **User messages (inputs/queries)**
  - Same centered column, but with a **faint tinted background** using `var(--user-chip-bg)` and a subtle `1px` border `var(--user-chip-border, var(--border-subtle))`.
  - Slightly tighter line-length than assistant content (e.g., max-width ~90% of the column) to visually distinguish without shifting position.
  - Rounded corners remain; remove asymmetric “tail” corners tied to left/right positioning.

- **Metadata**
  - Timestamps remain small and subtle. Assistant meta aligns left; user meta aligns right, but both remain inside the same centered column.

---

### 4) Spacing, padding, and container adjustments

- **Column**
  - Shared max width: reuse `--content-max-width` (e.g., 680–780px desktop).
  - Horizontal gutters: maintain outer page padding (e.g., 16–24px) so the column never touches screen edges.

- **Vertical rhythm**
  - Inter-message spacing: 16–20px desktop, 12–16px mobile.
  - Inside blocks: 12–16px padding for user chip backgrounds; assistant content remains mostly unboxed (padding only applies to nested code blocks, tables, callouts).

- **Readable line length**
  - Aim for ~65–80 characters per line for assistant prose by constraining column width.
  - Code blocks keep their own scroll if wider than the column.

---

### 5) Responsive behavior (desktop vs. mobile)

- **Desktop/tablet**
  - Fixed central column constrained by `--content-max-width`.
  - Consider slightly narrower column on smaller laptops (~640–700px) for optimal readability.

- **Mobile**
  - Column uses nearly full width minus safe gutters (e.g., 16px). Maintain consistent vertical rhythm.
  - User chips span the column width but keep their subtle background; assistant text remains plain.

- **Input alignment**

  - Keep the input bar at full width for usability, but align its inner content to the same column width for visual coherence with the messages.

---

### 6) Risks and checks

- **Scroll behavior**
  - Moving to a column wrapper can break the `scrollIntoView` sentinel if placed incorrectly. Ensure the `messagesEndRef` element remains the last child of the column wrapper and still resides inside the scrollable container.

- **Long content**
  - Code blocks, tables, and wide inline content should not expand the column; confirm horizontal overflow is handled (code blocks scroll within their container).
  - Very long unbroken strings must wrap or overflow safely (CSS `word-break`/`overflow-wrap` already present in earlier bubble styles; confirm equivalent handling in the centered skin).

- **Performance**
  - No change to rendering volume; however, extra wrapper layers shouldn’t disrupt virtualization if added later.

- **Voice mode / auxiliary UIs**
  - Center alignment must not interfere with voice-mode overlays (`VoiceMode`), history drawer, or settings panel z-index stacking.

---


### File touchpoints (no code changes included here)

- `frontend/src/components/ChatMessages/ChatMessages.tsx` — Wrap message list with a centered column; place `messagesEndRef` at the column bottom.
- `frontend/src/components/ChatMessages/ChatMessages.css` —
  - Add styles for the centered column and vertical rhythm.
  - Neutralize `.user-message`/`.assistant-message` `align-self` when the centered layout flag/class is active.
  - Constrain widths using `--content-max-width`; maintain overflow rules for code blocks and tables.
- `frontend/src/components/ChatInterface.tsx` and `frontend/src/components/ChatInterface.css` — Optionally add a page-level class to toggle the centered layout and align the input area’s inner content to the column width.
- `frontend/src/components/ChatMessages/AssistantBlock.tsx` and `UserChip.tsx` — Ensure visual differentiation is style-driven (background/border/typography) rather than positional.
- `frontend/src/components/FormattedMessage/FormattedMessage.tsx` — Confirm markdown typography and spacing are compatible with the centered column.

---

### Success criteria

- Both user and assistant messages appear in a single centered column with strong readability.
- Roles are visually distinct via background, border, and subtle width differences — not by left/right position.
- No regressions to scrolling, voice mode, history, or settings.
- Responsive behavior matches desktop and mobile expectations with consistent rhythm and safe gutters.


