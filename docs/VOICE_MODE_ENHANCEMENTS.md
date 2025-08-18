### Voice Mode Enhancements Plan

This document outlines a design and implementation plan to unify Voice Mode with the centered chat experience, emphasizing dynamism, clarity, and brand consistency. The goal is to make Voice Mode feel immersive and fluid while clearly connected to the chat flow.

---

### Objectives

- Create a fluid transition between chat and voice modes (fade the chat; no hard switch).
- Provide responsive, animated microphone feedback that reflects input intensity.
- Maintain context by showing the last 1–2 conversation bubbles faintly above the mic prompt.
- Use brand-consistent accent colors and shared control styles across chat and voice.
- Improve button prominence (cancel/send) with stronger contrast and subtle glow.
- Ensure coherent spacing, sizing, and radii for a balanced layout on all devices.

---

### Experience Principles

- **Clarity first**: Focus on what the user should do right now (speak or send/cancel) while keeping context available.
- **Continuity**: Voice Mode is an overlay of the chat, not a separate app. Retain visual anchors.
- **Responsiveness**: Animations respond smoothly to input amplitude; ideas feel “alive.”
- **Consistency**: Colors, radii, typography, and elevation match the chat system.

---

### UX Flow (High-Level)

1. User activates Voice Mode.
2. Chat content subtly fades and blurs in the background; overlay enters with a soft scale/opacity animation.
3. A central mic prompt appears with animated feedback (waveform/pulsing bars), and the placeholder reads “Start speaking…”.
4. When input is detected, the placeholder fades out; real-time transcript appears.
5. The last 1–2 conversation bubbles display above the prompt at reduced opacity for context.
6. Action buttons (Cancel/Send) use strong contrast and a soft glow; colors align with brand tokens.
7. On Send or Cancel, overlay transitions smoothly back to the chat (fade out; chat re-sharpens).

---

### Visual + Motion Specifications

- **Background treatment**
  - Keep current gradient; soften with a 6–10px backdrop blur on the chat behind the overlay.
  - Overlay container uses subtle elevation (shadow-sm) and a gentle scale-in (0.98 → 1.0).

- **Animated microphone feedback**
  - Two interchangeable styles (choose via prop/setting later):
    - Waveform (centered line with animating bezier path).
    - Pulsing bars (5–9 vertical bars) scaling Y based on input amplitude buckets.
  - Animation timing: 120ms refresh, easing `cubic-bezier(0.2, 0.8, 0.2, 1)`.
  - Color: `var(--brand-accent)` with 30–60% opacity fills; glow ring uses a 0 0 0 6–10px shadow tuned to theme.

- **Typography**
  - Placeholder: 0.95rem, `var(--text-secondary)`, fades to 0 on input start over 150–250ms.
  - Transcript: 1rem–1.05rem, `var(--text-primary)`, line-height `var(--line-height-body)`.

- **Context bubbles (last 1–2 turns)**
  - Display within the overlay, stacked above the mic prompt.
  - Opacity 0.45–0.6; disable borders/shadows; clamp to `--content-max-width`.
  - Truncate long code blocks; allow vertical scroll if needed (max-height ~30% viewport for context cluster).

- **Buttons (Cancel/Send)**
  - Shared radius: 10px (match chat), strong contrast, soft glow on hover/focus.
  - Primary action (Send): brand accent background or outlined with filled hover; text `#fff` on filled.
  - Secondary action (Cancel): neutral surface with border; text `var(--text-primary)`; hover uses `var(--inline-code-bg)`.
  - Elevation: default `shadow-sm`; hover `shadow-md`.

- **Spacing & layout**
  - Center block adheres to `--content-max-width` with side paddings.
  - Vertical rhythm: 16–24px between mic, transcript, context group, and buttons.
  - Ensure optical center on mobile and desktop (account for status bars / safe areas).

---

### Accessibility

- Preserve readable contrast for all states (check WCAG AA for text against backgrounds).
- Provide ARIA labels for microphone state (recording/paused) and live-region for transcript updates.
- Ensure the waveform/bars are decorative (aria-hidden) and not announced.
- Keyboard users: Tab focus order is predictable (Close/Cancel → Send → advanced controls if any).

---

### Implementation Plan (No Code Yet)

1. Overlay + Transition
   - Add a `VoiceModeOverlay` wrapper that mounts above chat, with fade/scale animation.
   - When entering Voice Mode, add a class to `chat-container` that applies a mild blur and opacity drop.

2. Mic Feedback Component
   - Create `MicVisualizer` with two variants (`waveform` | `bars`) controlled by prop.
   - Hook into existing `useVoiceRecognition` amplitude/rms if available; otherwise, compute via WebAudio analyser.
   - Expose minimal API: `isActive: boolean`, `intensity: 0–1`.

3. Placeholder Behavior
   - Keep “Start speaking…” in the transcript area; fade opacity to 0 once `intensity > threshold` or transcript non-empty.

4. Context Bubbles
   - Reuse `AssistantBlock` and `UserChip` in read-only, de-emphasized mode (reduced opacity; no borders/shadows; clipped height).
   - Fetch the last 1–2 messages from the current conversation state passed into the overlay.

5. Buttons
   - Introduce shared button classes that match chat controls: radius 10px, subtle shadow, brand accent variants.
   - Primary = Send; Secondary = Cancel. Ensure consistent sizes across chat and voice.

6. Tokens + Theming
   - Reuse existing tokens: `--brand-accent`, `--text-primary`, `--text-secondary`, `--content-max-width`.
   - Add optional `--mic-glow` shadow variable tuned for light/dark.

7. Animations
   - CSS keyframes for fade/scale, bar pulsing; requestAnimationFrame for waveform path updates.
   - Respect `prefers-reduced-motion` (reduce amplitude-driven animation and durations accordingly).

8. State Integration
   - Use the existing `useVoiceMode` to drive overlay visibility, transcript updates, and Send/Cancel actions.
   - Ensure no regressions to “auto-speak” logic when in voice mode.

9. Performance
   - Throttle visualizer updates (120ms) to reduce layout thrash; render to canvas or transform-only DOM for efficiency.
   - Avoid heavy shadows/filters on large areas; scope blur to background container.

10. QA + Rollout
   - Add a feature flag (e.g., `voiceMode.overlay.enabled`) to toggle the new experience.
   - Test across desktop/mobile, light/dark, reduced motion, and slow devices.

---

### File Touchpoints (Planned)

- `frontend/src/components/VoiceMode/VoiceMode.tsx` — wrap content with `VoiceModeOverlay`.
- `frontend/src/components/VoiceMode/MicVisualizer.tsx` — new component (waveform/bars).
- `frontend/src/components/VoiceMode/VoiceMode.css` — overlay layout, animations, visualizer styles, buttons.
- `frontend/src/components/ChatInterface.tsx` — apply background blur/opacity class while in voice mode.
- `frontend/src/components/ChatMessages/AssistantBlock.tsx` / `UserChip.tsx` — read-only, de-emphasized context rendering style hook.
- `frontend/src/styles/shared.css` — optional new tokens (`--mic-glow`), shared button variants.

---

### Interaction + Motion Details

- Enter Voice Mode
  - Chat container: opacity 1 → 0.55, blur 0 → 6–10px over 250ms.
  - Overlay: opacity 0 → 1, scale 0.98 → 1.0 over 220ms.

- Mic visualization
  - Bars: scaleY interpolates with input intensity; slight phase offset left→right.
  - Waveform: path amplitude based on smoothed RMS; 60–90fps rAF with throttling to 120ms paint batches.

- Placeholder fade
  - Opacity 1 → 0 over 150–250ms on first detection of input or receipt of partial transcript.

- Buttons
  - Hover: increase contrast, apply soft glow (`--mic-glow`), elevate from `shadow-sm` to `shadow-md`.
  - Focus: 2px focus ring in `--brand-accent`.

---

### Accessibility + Internationalization

- Announce recording state changes politely via ARIA live region.
- Ensure buttons have clear labels and large hit targets (min 44px on mobile).
- Placeholder and transcript should support RTL and long text wrapping.

---

### Risks + Mitigations

- Performance on low-end devices → throttle animations; allow disabling visualizer via setting.
- Visual clutter from context bubbles → clamp height and opacity; allow user to collapse.
- Regressions to existing voice flows → ship behind feature flag and add fast rollback.

---

### Success Criteria

- Users perceive Voice Mode as part of chat, not a separate view.
- Mic feedback visibly responds to input; placeholder fades on speech start.
- Context is visible without overwhelming the mic prompt.
- Controls look and feel identical to chat’s system (radius, elevation, colors).
- Smooth transitions in and out; no jarring jumps.

---

### Milestones (Implementation Sequence)

1) Overlay shell + transitions (enter/exit, background blur)

2) MicVisualizer (bars variant first; waveform second) + intensity wiring

3) Placeholder fade + transcript typography

4) Context bubbles (reuse chat components, de-emphasized styles)

5) Controls (shared button variants; brand-consistent colors; glow)

6) Tokens, reduced motion support, theming polish

7) QA, flag rollout, telemetry checks

---

### Telemetry (Optional)

- Time-to-first-speech after entering Voice Mode.
- Completion rate of Send vs Cancel.
- Feature adoption when enabled by default.


