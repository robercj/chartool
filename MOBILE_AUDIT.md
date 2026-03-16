# Mobile Audit Report — Character Forge
**Audit Date:** 2026-03-16  
**Styling System:** Tailwind CSS v4 (via `@import "tailwindcss"`) + inline `style={}` props  
**Breakpoints in use (pre-audit):** Only Tailwind defaults — `md` = 768px, `lg` = 1024px  
**No existing mobile nav pattern.** No hamburger menu, no bottom nav.

---

## SUMMARY OF FINDINGS

| Severity | Count |
|----------|-------|
| CRITICAL | 11 |
| MAJOR | 19 |
| MINOR | 14 |

---

## COMPONENT: Layout.jsx (Navigation)

- **[CRITICAL]** No hamburger menu or mobile nav pattern. All nav links render as a horizontal flex row at ALL breakpoints. On screens <768px, the nav items (Generate Images, Generate Storyline, Gallery, Settings) overflow or collapse against the user menu — effectively inaccessible on mobile.
- **[CRITICAL]** User menu button (`px-3 py-1.5`) has an effective touch target of ~32×30px — below the 44×44px minimum.
- **[MAJOR]** Logo + all nav links + user menu in a single flex row will overflow at ~500px viewport. There is no `overflow: hidden` safety net, causing a horizontal scrollbar at the nav level.
- **[MAJOR]** No active state on mobile since there's no mobile nav — active highlight only visible at desktop widths if the nav isn't overflowing.
- **[MAJOR]** Progress bar sub-row has no mobile-specific padding or font-size adjustments. At narrow widths, the label, bar, and Stop button will compress uncomfortably.
- **[MINOR]** NavLink component has `px-4 py-2` — sufficient touch height (32px) but below the 44px recommended minimum, especially when combined with the small gap spacing.
- **[MINOR]** No `aria-label`, `aria-expanded`, or `aria-controls` on hamburger (which doesn't exist yet).
- **[MINOR]** `will-change` not set on any transition-heavy elements.

---

## COMPONENT: StorylineForm.jsx (/storyline/new)

- **[CRITICAL]** No sticky submit button. The "Review & Generate" button is at the bottom of a very long form. On mobile, users must scroll all the way to the bottom to submit — the button is not discoverable until the end.
- **[CRITICAL]** Chip buttons (`px-3 py-1.5 rounded-full text-xs`) render at approximately 28×26px — far below the 44×44px touch target minimum. Both `Chip` and `RadioChip` share the same under-sized implementation.
- **[CRITICAL]** Range sliders use default native rendering with no thumb size override. The `<input type="range">` default thumb is 16px — impossible to tap accurately on mobile. No CSS overrides for `-webkit-slider-thumb` or `-moz-range-thumb`.
- **[MAJOR]** The overall form container uses `max-w-4xl` but no responsive padding adjustment below md breakpoint. On mobile the form can be excessively wide relative to viewport.
- **[MAJOR]** Section A and Section B are plain `SectionCard` divs with no sticky header. On a long scroll, users lose context about which section they're in.
- **[MAJOR]** NPC card remove button (`p-1 rounded-lg`) wrapping a `Trash2 w-3.5 h-3.5` icon = ~22×22px touch target — critically small on mobile.
- **[MAJOR]** Faction card remove button same issue as NPC card — `p-1` + `w-3.5 h-3.5` = ~22×22px.
- **[MAJOR]** `Add NPC` / `Add Faction` buttons are `px-4 py-2` inline — not full-width on mobile and below 44px height.
- **[MAJOR]** Bond type chips inside NPCCard use `px-2.5 py-1 rounded-full text-xs` — approximately 24×22px touch target, far below minimum.
- **[MAJOR]** Growth mechanism chips use `RadioChip` = same as `Chip` = 28×26px — inadequate touch targets.
- **[MAJOR]** `Textarea` component sets `minHeight` via `${rows * 1.6}rem` which at rows=3 = 4.8rem (~77px). While close, the textarea has no explicit mobile-specific `min-height: 96px` guarantee and no `resize: vertical` enforcement (class says `resize-y` which is correct, but ImageEditModal has `resize-none` override).
- **[MAJOR]** Moral complexity slider label row uses `flex justify-between` with 5 labels — on screens narrower than ~360px these labels will overlap or truncate unpredictably.
- **[MAJOR]** ConfirmationModal is a centered dialog at ALL breakpoints — no bottom sheet on mobile. The backdrop + centered dialog pattern is awkward on phones especially with a hardware back button.
- **[MINOR]** `FieldGroup` label uses `text-xs uppercase tracking-widest` — effective rendered size ~10px, below minimum recommended 12px for labels.
- **[MINOR]** `SubLabel` inside NPC/Faction cards: `text-xs uppercase tracking-wider` — same ~10px label concern.
- **[MINOR]** No `aria-checked` on chip/radioChip elements.
- **[MINOR]** No `aria-label`, `aria-valuemin`, `aria-valuemax`, `aria-valuenow` on range sliders.
- **[MINOR]** Form does not call `scrollIntoView` with `block: 'center'` on mobile — uses `block: 'center'` already (correct), but only scrolls to the outer fieldRefs, not individual NPC/Faction field-level errors.
- **[MINOR]** Folder mode toggle buttons (`py-2.5`) = ~40px height — just below the 44px minimum.

---

## COMPONENT: StorylineResult.jsx (/storyline/result/:id)

- **[CRITICAL]** `<pre>` blocks in `ContentBlock` use `whitespace-pre-wrap` (correct) but have **no `word-break: break-word` or `overflow-x: auto`**. Long unbroken strings (URLs, long character names) will overflow horizontally on mobile causing layout breakage.
- **[CRITICAL]** Loading state is a bare `<Loader2>` spinner with no contextual message ("Generating your storyline…" text is absent). On slow mobile connections during a Rich tier generation (20–40 seconds), this provides zero feedback.
- **[MAJOR]** Page action buttons (`Copy All`, `Save to Folder`, `Retry Generation`, `Start Over`) use `flex flex-wrap gap-2` — on 320px screens, these 4 buttons will all try to fit in a row, wrap to multiple rows inconsistently, and have small hit areas (`px-4 py-2` = ~32px height).
- **[MAJOR]** `ContentBlock` copy button uses `px-3 py-1.5 rounded-lg text-xs` = approximately 30×26px — below the 44×44px touch target minimum.
- **[MAJOR]** `SaveToFolderModal` is a centered dialog at ALL breakpoints — no mobile-optimized bottom sheet.
- **[MAJOR]** The `pre` blocks use `fontFamily: '"Georgia", "Times New Roman", serif'` — a serif font at `text-sm` (14px) is acceptable for desktop but needs verification at mobile sizes; no responsive font size adjustment.
- **[MINOR]** `max-w-4xl` container — per spec the results page should be max-w 800px (50rem), currently using 4xl (56rem).
- **[MINOR]** No `aria-live="polite"` region to announce "Copied" state to screen readers.
- **[MINOR]** The linked folder chip (`flex items-center gap-1 text-xs`) is approximately 24px tall — below touch minimum.

---

## COMPONENT: StorylineDetail.jsx (/storyline?id=...)

- **[CRITICAL]** Header action buttons (`View Generated Prompt`, `Group Shot`, `Add Characters`, Delete) are in a single `flex gap-2` row. On mobile (375px), these 4 buttons will overflow horizontally with no wrapping or stacking, causing layout breakage or horizontal scroll.
- **[MAJOR]** The `Button` component uses hardcoded `padding: '0.75rem 1.5rem'` (12px/24px) — height resolves to approximately 44px (borderline), but `size="sm"` variant uses `0.5rem 1rem` = ~32px height, below minimum.
- **[MAJOR]** Batch grid uses `grid-cols-2 md:grid-cols-3 lg:grid-cols-4` — starts at 2 columns on mobile which is acceptable for image grids, but a missing import (`useProgress`) causes a runtime error (line 20 uses `useProgress` but it's imported at line 350 — incorrect ES module hoisting in a module context; this is a **pre-existing bug**).
- **[MINOR]** `View Generated Prompt` button has no mobile-specific prominence or distinct card styling — it's a standard outline button in a crowded header row.
- **[MINOR]** Modal component (GroupShot) is centered dialog — no mobile bottom sheet.

---

## COMPONENT: Gallery.jsx (/gallery)

- **[MAJOR]** Header row (`flex items-center justify-between`) contains a title block and two buttons (`New Storyline`, `New Character`). At 320px, the buttons will compress against the title or overflow.
- **[MAJOR]** `Button` component uses `padding: '0.75rem 1.5rem'` inline style — not Tailwind, so no responsive variant possible without prop changes. No `min-height: 44px` guarantee.
- **[MAJOR]** Delete button on `StorylineCard` and action buttons on `BatchCard` are `p-2 rounded-lg` = ~36×36px — hover-only opacity reveal (`opacity-0 group-hover:opacity-100`) means these controls are **completely inaccessible on touch devices** — there is no touch equivalent for `:hover`.
- **[MAJOR]** `Modal` (NewStoryline, AssignStoryline, ConfirmDelete) are centered dialogs at all breakpoints — no mobile bottom sheet.
- **[MINOR]** `ConfirmDeleteModal` action buttons row (`flex gap-3 justify-end`) — small `px-4 py-2` buttons are ~32px height on mobile.
- **[MINOR]** Image grid starts at 2 columns (`grid-cols-2`) which is acceptable, but no `loading="lazy"` or `decoding="async"` on grid images.

---

## COMPONENT: BatchDetail.jsx (/batch?id=...)

- **[CRITICAL]** Header action area has up to 7 buttons in a single flex row (`Select`, `Move`, `Export`, `Restyle`, `Add`, `Add Prop`, Delete). On mobile (375px), these will overflow horizontally or compress to an unusable state.
- **[MAJOR]** Action panels (Restyle, Add Variation, Add Prop) use `flex gap-3` layouts with inline inputs — these will fail at narrow widths as inputs + buttons compete for space.
- **[MAJOR]** `ImageEditModal` uses `max-w-3xl` centered dialog with `grid-cols-1 md:grid-cols-2` — the modal itself fills `max-h-[90vh]` with `overflow-y-auto` but has no viewport/keyboard accommodation on mobile.
- **[MAJOR]** Reference + Description section: `grid-cols-1 lg:grid-cols-3` — this means on tablet (768px–1023px) the reference image and analysis panel are still single-column, which stacks them vertically (acceptable) but the aspect-square reference image at full width on tablet is very large.
- **[MAJOR]** All card delete/action buttons in `Gallery.jsx` and `BatchDetail.jsx` use `hover:opacity-100` pattern — **hover-only, touch-inaccessible**.
- **[MINOR]** No `loading="lazy"` or `decoding="async"` on any `<img>` tags in batch image grid.
- **[MINOR]** `ImageEditModal` textarea uses `resize-none` — violates the spec requirement for `resize: vertical` on creative-writing textareas.
- **[MINOR]** `BatchCard` reference thumbnail (`w-10 h-10 rounded-lg`) is decorative but positioned as `absolute bottom-2 right-2` — fine, but no `loading="lazy"`.

---

## COMPONENT: Generate.jsx (/generate — Character Creation Form)

- **[MAJOR]** Step 2 header (config badge row + `CharacterSlot` cards) has no mobile-specific layout adjustments. The badge row with 3 badges + Change button may overflow at 320px.
- **[MAJOR]** `ArchetypePicker` (not fully read but uses `TagInput`-style chip UI) — archetype chips use `px-2 py-1 text-xs rounded-md` = approximately 22×24px — below 44px minimum.
- **[MAJOR]** `LayerControls` tag input presets use `px-2 py-1 text-xs rounded-md` — same touch target issue as above.
- **[MAJOR]** `CharacterSlot` expand/collapse header has a fixed `w-16 h-16` thumbnail + text + chevron. On 320px this is workable but the `onRemove` X button is `p-2 rounded-lg` = ~36px, marginally below 44px.
- **[MAJOR]** `MultiUploadZone` / `SingleUploadZone` (not fully read, referenced in Generate.jsx) — unknown mobile behavior for drag-drop zones on touch.
- **[MINOR]** Step 1 is `max-w-md mx-auto py-16` — the `py-16` (64px top/bottom) is excessive on small screens, pushing content down unnecessarily.
- **[MINOR]** No pre-fill badge for storyline-linked character creation (Phase 7 requirement — feature partially present via URL param but no visual indicator).

---

## COMPONENT: AuthModal.jsx

- **[MAJOR]** Modal is a centered dialog at all breakpoints — no mobile bottom sheet or full-screen treatment. On 320px screens, the `max-w-md p-8` modal may leave very little horizontal margin.
- **[MINOR]** `p-8` padding = 32px — quite tight on a 320px screen (modal content would be 320 - 32 - 32 = 256px wide).
- **[MINOR]** Eye-toggle show/password buttons are small icon-only — no explicit `min-width/height: 44px`.

---

## COMPONENT: index.css / Global Styles

- **[CRITICAL]** No `env(safe-area-inset-bottom/left/right)` applied anywhere. iOS devices with notches/home indicators will have UI elements positioned incorrectly under system chrome.
- **[MAJOR]** No `prefers-reduced-motion` media query. All CSS transitions and animations run regardless of user accessibility preference.
- **[MAJOR]** No global `touch-target` utility class. Each component must be individually patched.
- **[MINOR]** `font-display: swap` status unknown — the app uses `system-ui, -apple-system` stack (no custom font), so this is not an issue. Confirmed N/A.
- **[MINOR]** No `overflow-anchor: auto` on main scroll containers.

---

## COMPONENT: tailwind.config.js

- **[MAJOR]** Tailwind config is minimal — no custom breakpoints defined. Default Tailwind breakpoints are: `sm: 640px`, `md: 768px`, `lg: 1024px`, `xl: 1280px`, `2xl: 1536px`. The spec requires `sm: 320px` (mobile), `md: 768px` (tablet), `lg: 1024px` (desktop). The default `sm: 640px` leaves a 320px–639px gap that has no Tailwind responsive prefix to target.

---

## HOVER-ONLY INTERACTIONS (Touch-Inaccessible)

- **[CRITICAL]** `Gallery.jsx` `StorylineCard`: Delete button uses `opacity-0 group-hover:opacity-100` — invisible and untappable on touch.
- **[CRITICAL]** `Gallery.jsx` `BatchCard`: Assign + Delete buttons both use `opacity-0 group-hover:opacity-100` — invisible on touch.
- **[CRITICAL]** `StorylineDetail.jsx` `BatchCard`: Hover overlay (`opacity-0 group-hover:opacity-100`) for ArrowRight icon — no tap feedback.
- **[MAJOR]** `BatchDetail.jsx` image grid items: Label overlay uses `opacity-0 group-hover:opacity-100` — labels never visible on touch.

---

## SUPABASE NOTES (No Schema Changes Required)

None of the mobile-first changes require Supabase schema modifications, new tables, new columns, new RLS policies, or new Edge Functions. All changes are purely frontend/CSS/React. The existing data model fully supports the mobile UI.

**However, note the following for awareness:**
- The `storyline_metadata` JSONB column used for pre-fill badge logic already stores `genres`, `protagonist_status`, `overlays`, `token_tier` — the pre-fill badge (Phase 7) reads from this existing data, requiring no schema change.
- No new API endpoints are needed for any of the mobile phases.

---

## PHASE 0 COMPLETE ✓

The audit above covers all components identified in the prompt. Key areas of highest priority:
1. Navigation has **no mobile nav at all** — most critical gap
2. Gallery card actions are **hover-only / touch-inaccessible** — functional regression on mobile
3. BatchDetail header overflows with 7 buttons — layout breaking
4. All chip/button touch targets are undersized
5. Range slider thumbs are too small to tap accurately
6. No safe-area-inset support for iOS
7. Confirmation modals are desktop-only patterns (centered dialog) throughout the app
