## Goal

Create a beautiful, elegant, non-scroll login/landing experience for Comprehension Engine that rivals the polish of Cursor’s homepage while preserving our existing auth flow. The screen should immediately transition to a branded loading state after tapping “Continue with Google,” have smooth logout transitions, remove the email option, and include a compelling header and copy focused on accelerated human learning.

## Success Criteria (Acceptance Tests)

- The login page occupies the full viewport (100vh) with no scrolling; background is a multi‑color gradient.
- A lightweight header mimicking Cursor’s layout: brand mark on the left, nothing distracting on the right.
- A centered CTA: one primary button “Continue with Google”. No email option visible anywhere on this page.
- Tapping the CTA navigates within ~100ms to a loading screen (branded cube/diamond loader or simple spinner fallback) while the Google OAuth popup/redirect proceeds.
- Logging out fades/animates to login with no abrupt flash, then shows the login page.
- Accessible text contrast and keyboard navigation; respects reduced motion preference.
- Jest/RTL tests cover: render states, button presence, absence of email form, immediate route-to-loader, logout transition, no-scroll behavior, header content, and basic a11y violations.

## UX Copy (Proposals)

- Recommended main headline: “Learn Faster, Deeper”
- Recommended subheader: “Your AI learning companion that personalizes how you understand complex ideas—accelerating mastery by an order of magnitude.”

Other four-word options (shortlist):
- “Understand Anything, Faster”
- “Accelerate Human Understanding”
- “Master Complex Ideas”
- “Clarity at Speed”
- “Insight, On Demand”
- “Think Deeper, Faster”
- “Personalized Learning Velocity”
- “10x Your Mastery”
- “Precision Learning Engine”
- “From Confusion to Clarity”

Alternate subheaders (pick one if preferred):
- “A personal AI that learns how you learn to boost comprehension and retention.”
- “Cut through complexity with a companion that adapts to your cognition.”
- “Turn dense material into rapid, durable understanding.”

## Visual and Layout Spec

- Full-bleed, non-scroll section: container uses 100vh; body overflow hidden while on login route.
- Gradient background (3–4 colors) with subtle grain/noise overlay for depth (optional). Example stop ideas: `#7C3AED` → `#EC4899` → `#22D3EE` → `#F59E0B` with low-contrast rotation.
- Header: left-aligned brand logo (use `frontend/public/brand-icon.png` sourced from `ComprehensionEngine/Assets.xcassets/AppIcon.appiconset/1024.png`), brand wordmark text next to it. No nav items to reduce friction.
- Center stack: H1, subheader, primary CTA.
- CTA: Google button with icon; high contrast; hover/active states; focus ring visible.
- Loading screen: branded diamond/cube pulse or rotate (CSS transforms + blur/glow). Provide basic spinner fallback if `prefers-reduced-motion` is enabled or if WebGL not available.
- Smooth transitions: cross-fade and slight scale on page change; respect reduced motion.

## Information Architecture

- Routes
  - `/login` (current `Login.tsx`) → new visual design
  - `/auth/processing` (`AuthProcessing.tsx`) → branded loader while OAuth completes
  - Post-auth redirect unchanged

## Implementation Plan (Discrete Tasks)

1) Asset Prep
- Export iOS icon `1024.png` into web-ready `frontend/public/brand-icon.png`.
- Ensure `frontend/public/manifest.json` remains valid; do not regress PWA icons.

2) Header Component
- Create `frontend/src/components/ChatHeader/MarketingHeader.tsx` (or reuse `ChatHeader` styles with a marketing variant prop) with: logo image, wordmark text, and minimal layout.
- Add `MarketingHeader.css` with responsive spacing and contrast-aware colors.

3) Login Page Redesign
- Edit `frontend/src/components/Auth/Login.tsx` and `Login.css`:
  - Replace layout with full-viewport container and gradient background.
  - Remove email auth section entirely.
  - Add recommended H1 and subheader copy.
  - Center and style a single “Continue with Google” button.
  - On click: set a local `isProcessing` flag, navigate to `/auth/processing` within ~100ms.
- Ensure `document.body.style.overflow = 'hidden'` while on `/login`; restore on unmount.

4) Processing Screen
- Add `frontend/src/components/Auth/AuthProcessing.tsx` and stylesheet:
  - Branded cube/diamond loader using CSS transforms and glow; provide `prefers-reduced-motion` static variant.
  - Optional fallback: basic spinner element.

5) Routing
- Update `frontend/src/App.tsx` to include route for `/auth/processing` and ensure `ProtectedRoute` redirects unauthenticated users to `/login` without flashing content.

6) Smooth Logout Transition
- In `frontend/src/context/AuthContext.tsx` or logout trigger location, wrap logout navigation with a small transition coordinator:
  - Add a `ui:isTransitioning` flag/context to fade out current view before navigating to `/login`.
  - Keep transition ≤200ms and respect reduced motion.

7) Theming & Tokens
- Add CSS variables in `frontend/src/styles/shared.css` for gradient stops, brand glow, text color, and focus ring to ensure consistency.

8) Accessibility
- Maintain contrast >= 4.5:1 for text atop gradient via semi-transparent overlay.
- Keyboard focus on the Google button by default; Escape closes any residual dialogs.
- ARIA labels for loader: `role="status"` with `aria-live="polite"`.
- Respect `prefers-reduced-motion` in animations.

9) Testing (Regression Guard)
- Unit/Integration (Jest + React Testing Library):
  - `Login renders correctly` (header, H1, subheader, Google CTA present; email section absent).
  - `Clicking Google CTA navigates to processing` (use fake timers to assert navigation within 100ms; loader visible).
  - `No scroll on login` (container 100vh and body overflow hidden; restored after unmount).
  - `Logout transitions smooth` (mock logout; assert fade class applied, then route to `/login`).
  - `Header snapshot` to detect unexpected UI changes.
  - `Basic a11y` using `jest-axe` (add dev dependency) for login and processing.
- Optional E2E (later): minimal Playwright spec verifying the same flows in a headless browser.

10) Performance
- Keep CSS-only animations where possible; avoid heavy libraries; prefer `transform` + `opacity` for 60fps.
- Lazy-load large assets; compress `brand-icon.png` if needed.

11) Rollout & Fallbacks
- Feature-flag the new login route behind an env var if desired (quick to disable).
- Provide spinner fallback if branded loader fails.

## File Touch List

- `frontend/public/brand-icon.png` (new asset copied from iOS `1024.png`)
- `frontend/src/components/ChatHeader/MarketingHeader.tsx` (new)
- `frontend/src/components/ChatHeader/MarketingHeader.css` (new)
- `frontend/src/components/Auth/Login.tsx` (edit)
- `frontend/src/components/Auth/Login.css` (edit)
- `frontend/src/components/Auth/AuthProcessing.tsx` (new)
- `frontend/src/components/Auth/AuthProcessing.css` (new)
- `frontend/src/App.tsx` (edit route config)
- `frontend/src/context/AuthContext.tsx` (small change for logout transition, if not already centralized)
- `frontend/src/styles/shared.css` (tokens/variables)
- Tests:
  - `frontend/src/components/Auth/__tests__/Login.spec.tsx` (new)
  - `frontend/src/components/Auth/__tests__/AuthProcessing.spec.tsx` (new)
  - `frontend/src/components/ChatHeader/__tests__/MarketingHeader.spec.tsx` (new)
  - `frontend/src/components/Auth/__tests__/LogoutTransition.spec.tsx` (new)

## Risk Mitigation

- Keep the auth logic untouched; only adjust UI and navigation timing.
- Gate logout animation with reduced-motion to avoid user discomfort.
- Snapshot and a11y tests to catch regressions early.

## Open Questions (Please Confirm)

- Approve the recommended headline/subheader or choose from the shortlist.
- Preference for cube/diamond loader vs. minimal spinner as the default? (We’ll implement both with graceful fallback.)
- Should we keep any secondary link (e.g., “Learn more”) in the header, or keep it ultra-minimal?

## Timeline (Fast Track Tonight)

- 1.5h: Header + layout scaffolding, gradient, and copy
- 1h: Processing screen + transitions
- 0.5h: Remove email flow + logout transition polish
- 1h: Tests (RTL + jest-axe) and fixes
- 0.5h: Asset prep + final pass

Total: ~4.5 hours focused work


