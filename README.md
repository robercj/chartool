# Character Forge

AI-powered character image generation, character creation wizard, and storyline prompt builder for writers, game developers, and creators. Built with React 19, Vite 8, Supabase, Anthropic Claude, and fal.ai.

---

## Table of Contents

1. [Overview](#overview)
2. [Tech Stack](#tech-stack)
3. [Project Structure](#project-structure)
4. [Architecture](#architecture)
5. [Pages & Features](#pages--features)
6. [Components](#components)
7. [Context Providers](#context-providers)
8. [Library Modules](#library-modules)
9. [Supabase Edge Functions](#supabase-edge-functions)
10. [Database Schema](#database-schema)
11. [Authentication & Authorization](#authentication--authorization)
12. [Usage Limiting](#usage-limiting)
13. [Stripe Billing Integration](#stripe-billing-integration)
14. [Environment Variables](#environment-variables)
15. [Local Development](#local-development)
16. [Deployment](#deployment)

---

## Overview

Character Forge lets authenticated users:

- **Generate character image sets** from reference photos using AI analysis (Anthropic Claude) and image synthesis (fal.ai nano-banana-2).
- **Build fully-detailed characters** from scratch using the character creation wizard — identity, appearance, personality, backstory, voice — then generate a portrait with fal.ai and finalize as an immutable character record.
- **Create structured storyline prompts** from detailed narrative inputs using the Narrative Architecture Agent (Claude claude-opus-4-5).
- **Organize characters, batches, and storylines** into folders/collections in the Gallery.
- **Export** character image sets as ZIP archives.
- **Manage account subscriptions** via Stripe.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend framework | React 19 + Vite 8 |
| Routing | React Router DOM 7 |
| State / Data fetching | TanStack React Query 5 |
| UI styling | Tailwind CSS 4 + DaisyUI 5 |
| Icons | Lucide React |
| Notifications | Sonner 2 |
| Backend / Auth / DB | Supabase (Postgres + Edge Functions + Auth) |
| LLM | Anthropic Claude (claude-sonnet-4-5 / claude-opus-4-5) |
| Image generation | fal.ai (nano-banana-2 / nano-banana-2/edit) |
| Background removal | fal.ai (imageutils/rembg) |
| Billing | Stripe Checkout + Webhooks |
| Package manager | npm |

---

## Project Structure

```
character-forge/
├── public/                         # Static assets (favicon, SVG icon sprite)
├── src/
│   ├── main.jsx                    # React entry point, provider tree, route definitions
│   ├── App.jsx                     # DEPRECATED — routes consolidated into main.jsx
│   ├── index.css                   # Tailwind v4 CSS-first config, DaisyUI theme, design tokens
│   ├── assets/                     # Images, fonts
│   ├── contexts/
│   │   ├── AuthContext.jsx         # Auth state, profile, tier, usage, limit checks
│   │   ├── ThemeContext.jsx        # Genre-based visual theming (8 genres)
│   │   └── ProgressContext.jsx     # Global generation progress bar + AbortController
│   ├── components/
│   │   ├── Layout.jsx              # Fixed nav bar, progress bar, auth area, mobile drawer
│   │   ├── AuthModal.jsx           # Login / register / forgot password modal
│   │   ├── ProtectedRoute.jsx      # Route guard — shows AuthModal if unauthenticated
│   │   └── character/
│   │       ├── AppearanceForm.jsx          # Character appearance accordion form
│   │       ├── CharacterIdentityForm.jsx   # Full character identity/personality form
│   │       ├── DerePresetSelector.jsx      # 18 dere-type preset picker
│   │       ├── ExitConfirmationModal.jsx   # Dirty-state navigation guard
│   │       ├── ImageEditContext.jsx        # Image history, regenerate, seed control
│   │       ├── PillTagInput.jsx            # Tag input with pill UI
│   │       └── PromptPreviewPanel.jsx      # JSON prompt editor + generation trigger
│   ├── pages/
│   │   ├── Generate.jsx            # Batch character image generation (reference-photo workflow)
│   │   ├── GenerateCharacter.jsx   # Character creation wizard (3-phase: identity→appearance→generate)
│   │   ├── CharacterList.jsx       # Finalized characters + draft management
│   │   ├── Gallery.jsx             # Storyline and batch library overview
│   │   ├── BatchDetail.jsx         # Individual character batch — images, edit, restyle, export
│   │   ├── StorylineDetail.jsx     # Single storyline — batches, group shots
│   │   ├── StorylineForm.jsx       # Multi-section storyline prompt builder
│   │   ├── StorylineResult.jsx     # Rendered storyline prompt output
│   │   ├── Settings.jsx            # Account, plan, usage, billing, security
│   │   └── AuthCallback.jsx        # OAuth redirect handler
│   └── lib/
│       ├── supabase.js             # Supabase client singleton
│       ├── anthropic.js            # AI API wrappers — all calls proxy through edge functions
│       ├── storage.js              # Supabase data layer: Storyline, CharacterBatch, etc.
│       ├── stripe.js               # Stripe checkout and portal redirect helpers
│       ├── seedSettings.js         # DEPRECATED — no-op, safe to delete
│       ├── constants/
│       │   └── DERE_PRESETS.ts     # Dere types, archetypes, alignments, and option lists
│       └── hooks/
│           └── useDraftPersistence.js  # Dual-layer draft auto-save (localStorage + Supabase)
├── supabase/
│   ├── functions/
│   │   ├── anthropic-proxy/        # Edge Function: LLM proxy with auth + rate limiting
│   │   ├── fal-generate/           # Edge Function: reference-guided image generation
│   │   ├── fal-generate-character/ # Edge Function: text-to-image character generation
│   │   ├── fal-rembg/              # Edge Function: background removal
│   │   ├── stripe-checkout/        # Edge Function: Stripe Checkout Session creation
│   │   └── stripe-webhook/         # Edge Function: Stripe webhook handler
│   └── migrations/
│       ├── 001_initial_schema.sql      # Core tables, RLS, triggers, seed data
│       ├── 002_rpc_increment_usage.sql # Atomic usage counter upsert RPC
│       ├── 003_admin_helpers.sql       # Manual admin SQL snippets (commented out)
│       ├── 004_stripe_billing.sql      # Stripe billing columns + sync_tier_from_subscription RPC
│       ├── 005_character_generate_feature.sql  # ALTER characters to add character wizard columns
│       └── 006_add_character_columns.sql       # Comprehensive character column additions
├── supabasemigrations/
│   └── 20260316_character_generate_feature.sql  # Standalone: creates character_drafts + characters tables
├── .env.example                # Required environment variable template
├── vite.config.js
├── tailwind.config.js
├── eslint.config.js
└── package.json
```

> **Note on migrations:** The `supabase/migrations/` folder is used with `supabase db push` (ordered by filename prefix). The `supabasemigrations/` folder contains a standalone migration for the character generation feature that creates the `character_drafts` and `characters` tables — run this first if the tables don't exist yet.

---

## Architecture

```
Browser (React SPA)
    │
    ├─── React Router → pages (Generate, GenerateCharacter, Gallery, …)
    │
    ├─── TanStack Query → caches Supabase data
    │
    ├─── AuthContext → Supabase Auth session + profile + tier
    │
    └─── lib/anthropic.js ──► supabase.functions.invoke()
                                     │
                     ┌───────────────┼──────────────────────┐
                     ▼               ▼                       ▼
              anthropic-proxy   fal-generate            fal-rembg
              (Claude API)      fal-generate-character  (fal.ai rembg)
                     │          (fal.ai nano-banana-2)
                     └───── increment_usage RPC ──► Postgres usage table
```

All AI API keys (`ANTHROPIC_KEY`, `FAL_KEY`, `STRIPE_SECRET_KEY`) are stored exclusively as Supabase Edge Function secrets and are never exposed to the browser.

---

## Pages & Features

### `Generate.jsx` — Batch Character Image Generation

Reference-photo workflow for generating multiple images of existing characters.

**Step 1 — Storyline Selection**
- **New Storyline**: Name input, images-per-character slider (1–20), genre picker, keep-integrity toggle, art style selector.
- **Existing Storyline**: Select from user's saved storylines.
- **Recent Characters**: Last 5 batches shown for quick resume. Clicking navigates to the batch detail page.

**Step 2 — Character Configuration**
Each `CharacterSlot` supports:
- Multi-image source upload (multiple reference angles; primary labelled)
- Character name, archetypes (28 options), character arc textarea
- Keep Integrity / Remove Background toggles
- Shot type (Portrait / Half-body / Full-body) and aspect ratio (10 options: 21:9 → 9:16)
- Held items toggle with prop reference image upload
- Layer overrides: Pose, Expression, Outfit (preset chips + custom tags)
- Live preview grid showing images as they complete

**Generation Pipeline (`handleForge`)**
1. Creates storyline in DB if new
2. Per character:
   - Phase 1: Claude analyzes all reference images → detailed character description
   - Phase 2: Claude generates N pose/emotion variation objects (JSON)
   - Creates `CharacterBatch` record in DB
   - Per variation: `fal-generate` → optional `fal-rembg` → `GeneratedImage.create` → live preview update
   - Failed images tracked with full prompt + reference URLs for per-image retry

---

### `GenerateCharacter.jsx` — Character Creation Wizard

Three-phase wizard for building fully-specified characters from scratch.

**Phase 1 — Identity**: `CharacterIdentityForm` — name, role, archetype, demographics, personality (dere presets), psychology, backstory, voice.

**Phase 2 — Appearance**: `AppearanceForm` — body type, hair/eyes, facial features, clothing, accessories, visual motifs.

**Phase 3 — Generate**: `PromptPreviewPanel` for JSON prompt editing and initial generation. Once an image exists, switches to `ImageEditContext` for history browsing, seed control, and regeneration.

**Draft persistence**: `useDraftPersistence` hook auto-saves to localStorage (immediate) and Supabase DB (debounced 2 s). A new `CharacterDraft` record is created on mount if no `draftId` is present.

**Finalization**: Validates required fields → `generateCharacterManifest` (Claude) → `Character.create` → draft deleted → navigates to `/characters/:id`.

---

### `CharacterList.jsx` — Character Library

- **Finalized tab**: Character grid with image, name, archetype, creation date
- **Drafts tab**: List with thumbnail, name, last modified, delete button
- "New Character" navigates to `/characters/generate`

---

### `Gallery.jsx` — Library Overview

- Lists all storylines with 2×2 image previews and batch counts
- Lists unassigned character batches
- Actions: Create storyline, assign batch to storyline, delete (with cascade warning)

---

### `BatchDetail.jsx` — Character Batch Detail

**Image Grid**: Dynamic aspect ratio — images render at natural proportions.

**Actions**
- **Select**: Bulk mode → Export Selected or Delete Selected
- **Move**: Assign to a different storyline
- **Export**: Download all images as ZIP (via JSZip from esm.sh CDN)
- **Restyle**: Apply a new art style — creates new image records (originals preserved)
- **Add**: Generate a new pose/emotion variation
- **Prop**: Generate a variation with a prop reference image
- **Delete**: Delete batch and all images

**Image Edit Modal**: Click an image → lightbox (full-resolution, zoom-in view) with label, describe-changes textarea, Regenerate, Download.

**Analysis Panel**: Collapsible accordion showing the Claude character description used for generation. Persisted in `character_batches.character_description`.

---

### `StorylineDetail.jsx` — Storyline View

- Lists all character batches in the storyline
- Group Shot: generates multi-character scene images (1–5 shots)
- Add Characters: navigates to `/generate?storylineId=...`
- Delete storyline (batches unassigned, not deleted)

---

### `StorylineForm.jsx` — Storyline Prompt Builder

Multi-section form:
- **Section A**: World & protagonist (genre chips, opening situation, protagonist details, NPCs, factions, power systems)
- **Section B**: Narrative physics (structural overlays, power fantasy ratio, moral complexity, hooks)
- Token tier selection (Lite / Standard / Rich) controls Claude's `max_tokens`
- Output saved to `storyline_prompts` table

---

### `StorylineResult.jsx` — Prompt Output

- Displays parsed Section A / B / C from stored prompt
- Per-section copy buttons, Copy All, Save to Folder, Retry, Start Over
- `useCopy` hook with clipboard API + textarea fallback for older mobile browsers

---

### `Settings.jsx` — Account Settings

**Profile**: Display name (editable), email (read-only)
**Plan & Usage**:
- Current plan badge with usage bars (images, storylines)
- Pricing cards for Free / Pro / Enterprise
- Upgrade button → Stripe Checkout
- Manage Billing button → Stripe Customer Portal (active subscribers only)
**Security**: Password change via Supabase auth

---

## Components

### `Layout.jsx`
Fixed navigation bar with:
- Logo with genre-themed gradient
- Navigation links: Generate Images, Generate Character, Generate Storyline, Gallery, Settings
- Auth area: tier badge, usage bars, Sign Out (authenticated) or Sign In button (guest)
- Global progress bar (indeterminate or fraction) with Stop/cancel button
- Sonner `<Toaster>` for toast notifications
- Mobile drawer with focus trap and Escape key support

### `AuthModal.jsx`
Three-mode modal: `login`, `register`, `forgot`
- Email/password with show/hide toggle
- Google OAuth
- Display name collection on register

### `ProtectedRoute.jsx`
- Renders `children` immediately if authenticated (even during profile reload)
- Shows loading spinner while session resolves on initial load
- Shows non-dismissible AuthModal over a blurred placeholder for unauthenticated users

### `character/` Components

| Component | Purpose |
|---|---|
| `CharacterIdentityForm.jsx` | Large identity/personality form with all character fields |
| `AppearanceForm.jsx` | Collapsible appearance accordion |
| `DerePresetSelector.jsx` | 18 dere-type preset grid with tooltip descriptions |
| `ExitConfirmationModal.jsx` | Save draft / leave / stay guard for dirty state |
| `ImageEditContext.jsx` | Image history strip, regenerate controls, seed lock |
| `PillTagInput.jsx` | Tag input with pill UI |
| `PromptPreviewPanel.jsx` | JSON prompt editor with live validation + generation trigger |

---

## Context Providers

### `AuthContext.jsx`

| Export | Type | Description |
|---|---|---|
| `user` | `Object\|null` | Supabase auth user |
| `profile` | `Object\|null` | `profiles` row including Stripe subscription fields |
| `tier` | `Object\|null` | Joined `tiers` row with limits and Stripe price IDs |
| `usage` | `{image, story}` | Current month usage counts |
| `loading` | `boolean` | True until session + profile resolved |
| `signIn(email, pw)` | `Function` | Email/password sign-in |
| `signUp(email, pw, name)` | `Function` | Registration with display name |
| `signInWithGoogle()` | `Function` | OAuth sign-in |
| `signOut()` | `Function` | Sign out |
| `resetPassword(email)` | `Function` | Send password reset email |
| `checkLimit(type)` | `Function` | Returns `{allowed, reason, current, limit}` |
| `incrementUsage(type, amount)` | `Function` | Optimistic + server usage increment |
| `refreshProfile()` | `Function` | Re-fetch profile, tier, usage from DB |

### `ThemeContext.jsx`

Provides `{ theme, genreKey, setGenreKey, GENRES }`. Eight genre themes: `default`, `noir`, `fantasy`, `cyberpunk`, `romance`, `horror`, `anime`, `adventure`. Genre preference persisted in `localStorage` under `cf_genre`.

### `ProgressContext.jsx`

Provides global generation progress bar state and `AbortController` for cancellation:

| Export | Description |
|---|---|
| `progress` | `{label, current, total, taskRoute}\|null` — `total=null` for indeterminate |
| `generating` | `boolean` — true while any generation is active |
| `startProgress(label, total, route)` | Begin a tracked operation; creates a new AbortController |
| `updateProgress(current)` | Update current step count |
| `setProgressLabel(label)` | Update the display label mid-operation |
| `clearProgress()` | Clear and hide the progress bar |
| `stopProgress(onStop)` | Cancel + run optional callback |
| `isCancelled()` | Synchronous cancellation check (ref-based, no re-render) |
| `getAbortSignal()` | Returns the current `AbortSignal` for fetch cancellation |

---

## Library Modules

### `src/lib/supabase.js`

Creates and exports the Supabase client singleton. Reads `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from environment. Throws on missing values.

### `src/lib/anthropic.js`

All AI calls are proxied through Supabase Edge Functions. No API keys in the browser.

| Function | Description |
|---|---|
| `callLLM({ prompt, imageUrls, responseSchema, generationType })` | Claude claude-sonnet-4-5 call; JSON-parses if `responseSchema` provided |
| `callStorylineAPI({ formPayload, maxTokens })` | Claude claude-opus-4-5 for rich storyline generation |
| `generateImage({ prompt, referenceImageUrls, referenceImageUrl, propImageUrl, aspectRatio })` | fal.ai nano-banana-2/edit; returns CDN URL |
| `removeImageBackground(imageUrl)` | fal.ai rembg background removal; returns CDN URL |
| `synthesizeCharacterImagePrompt(characterData)` | Claude claude-sonnet-4-5 → image prompt string for character wizard |
| `generateCharacterManifest(characterData)` | Claude → `{ manifest, imagePrompt? }` for character finalization |
| `generateCharacterImage({ prompt, seed })` | fal.ai nano-banana-2 text-to-image; returns `{ url, seed, jobId }` |
| `LimitError` | Thrown on HTTP 429 (usage limit reached) |

### `src/lib/storage.js`

Supabase-backed data layer. All methods are async.

**`Storyline`**
- `list(userId)` — All storylines for user, newest first; attaches `batch_ids[]`
- `get(id)` — Single storyline; attaches `batch_ids[]`
- `create(userId, data)` — Returns created record
- `update(id, data)` — Partial update
- `delete(id)`

**`CharacterBatch`**
- `list(userId)`, `get(id)`, `create(userId, data)`, `update(id, data)`, `delete(id)`
- `forStoryline(storylineId)` — Batches in a storyline, newest first
- `assignStoryline(batchId, storylineId)` — Assign or unassign (`null`)

**`GeneratedImage`**
- `list(userId)`, `get(id)`, `create(userId, data)`, `update(id, data)`, `delete(id)`
- `filter({ batch_id }, orderBy, limit)` — Filtered list for a batch

**`StorylinePrompt`**
- `get(id)`, `create(userId, data)`, `update(id, data)`, `delete(id)`

**`CharacterDraft`**
- `list(userId)`, `get(id)`, `create(userId, data)`, `update(id, data)`, `delete(id)`
- `forStoryline(storylineId)` — Drafts assigned to a storyline

**`Character`**
- `list(userId)`, `get(id)`, `create(userId, data)`, `update(id, data)`, `delete(id)`
- `forStoryline(storylineId)` — Finalized characters in a storyline
- `unassigned(userId)` — Characters with no assigned storyline

### `src/lib/hooks/useDraftPersistence.js`

Custom hook for character draft auto-save with dual-layer persistence:
- **localStorage**: immediate write on every change
- **Supabase DB**: debounced 2 s write (when authenticated)
- Saves on `visibilitychange` (tab hide) and warns on `beforeunload` if dirty

### `src/lib/constants/DERE_PRESETS.ts`

Exported constants for the character wizard:
- `DERE_PRESETS` — 18 dere types with surface/hidden behavior and speech hints
- `ARCHETYPES` — 20 narrative archetypes
- `MORAL_ALIGNMENTS` — 9 D&D alignments
- `SOCIAL_CLASSES`, `BODY_TYPES`, `SEX_OPTIONS`, `GENDER_EXPRESSION_OPTIONS`, `TONE_OPTIONS`, `ROLE_OPTIONS`

### `src/lib/stripe.js`

| Function | Description |
|---|---|
| `redirectToCheckout(priceId)` | Calls `stripe-checkout` edge function; redirects browser to Stripe-hosted checkout |
| `redirectToCustomerPortal()` | Calls `stripe-portal` edge function; redirects to Stripe Customer Portal |

---

## Supabase Edge Functions

All edge functions are Deno TypeScript and live in `supabase/functions/`.

> **Auth note**: `anthropic-proxy`, `fal-generate`, `fal-generate-character`, and `fal-rembg` use the `CharacterForge` secret (a non-standard secret name for the new `sb_secret_` key format) and must be deployed with `--no-verify-jwt`. `stripe-checkout` and `stripe-webhook` use the standard `SUPABASE_SERVICE_ROLE_KEY`.

### `anthropic-proxy`

**Route**: `POST /functions/v1/anthropic-proxy`

Proxies requests to the Anthropic Messages API.

1. Extracts user ID by decoding the JWT payload (signature already verified at edge)
2. Checks usage limits via `profiles + tiers + usage` query
3. Strips the `_generation_type` field, forwards body to Anthropic API
4. On 2xx: calls `increment_usage` RPC
5. Returns HTTP 429 if user is at their monthly limit

**Required secrets**: `CharacterForge`, `ANTHROPIC_KEY`

---

### `fal-generate`

**Route**: `POST /functions/v1/fal-generate`

Proxies reference-image-guided generation requests to `fal-ai/nano-banana-2/edit`.

1. JWT auth + image usage limit check
2. Validates `input.image_urls` (min 1 required)
3. Calls fal.ai in `sync_mode: true` (no polling)
4. Retries up to 3× with linear backoff + jitter; respects `Retry-After` on 429
5. On success: `increment_usage` RPC + returns `{ images }`

**Required secrets**: `CharacterForge`, `FAL_KEY`

---

### `fal-generate-character`

**Route**: `POST /functions/v1/fal-generate-character`

Text-to-image generation via `fal-ai/nano-banana-2`. Used by the character creation wizard.

1. JWT auth + image usage limit check
2. Requires `prompt` string; `seed`, `aspect_ratio`, `num_images` are optional
3. Same retry/timeout logic as `fal-generate`
4. Returns `{ images: [{ url, seed }], request_id }`

**Required secrets**: `CharacterForge`, `FAL_KEY`

---

### `fal-rembg`

**Route**: `POST /functions/v1/fal-rembg`

Background removal via `fal-ai/imageutils/rembg`. No usage counting.

1. JWT auth (no limit check, no usage increment)
2. Calls fal.ai in `sync_mode: true`
3. Returns `{ image: { url } }`

**Required secrets**: `CharacterForge`, `FAL_KEY`

---

### `stripe-checkout`

**Route**: `POST /functions/v1/stripe-checkout`

Creates a Stripe Checkout Session for subscription upgrades.

**Request body**: `{ priceId: string }`
**Response**: `{ url: string }` — Stripe-hosted checkout page URL

1. JWT auth via `supabaseAdmin.auth.getUser(jwt)` (standard JWT path)
2. Retrieves or creates Stripe customer; persists `stripe_customer_id` to `profiles`
3. Creates Checkout Session in `subscription` mode
4. Returns session URL for browser redirect

**Required secrets**: `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `APP_URL`

---

### `stripe-webhook`

**Route**: `POST /functions/v1/stripe-webhook`

Handles Stripe webhook events for subscription lifecycle management.

**Handled events**:
- `checkout.session.completed` — Activates subscription post-purchase
- `customer.subscription.created` / `updated` — Syncs tier via `sync_tier_from_subscription` RPC
- `customer.subscription.deleted` — Downgrades user to Free
- `invoice.payment_failed` — Marks subscription as `past_due`
- `invoice.payment_succeeded` — Confirms `active` status

Implements manual HMAC-SHA256 signature verification and idempotency via `stripe_events` table.

**Required secrets**: `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`

---

## Database Schema

### Tables

| Table | Key Columns |
|---|---|
| `tiers` | `id (PK)`, `display_name`, `monthly_image_limit`, `monthly_story_limit`, `daily_image_limit`, `daily_story_limit`, `stripe_price_id`, `features[]` |
| `profiles` | `id (FK→auth.users)`, `email`, `display_name`, `tier_id (FK→tiers)`, `stripe_customer_id`, `stripe_subscription_id`, `stripe_subscription_status`, `subscription_period_end` |
| `usage` | `user_id`, `type (image\|story)`, `period (date)`, `count`. Unique on `(user_id, type, period)` |
| `storylines` | `user_id`, `name`, `storyline_art_style`, `storyline_prompt_id`, `storyline_metadata (jsonb)` |
| `storyline_prompts` | `user_id`, `storyline_id`, `raw_response`, `section_a`, `section_b`, `section_c`, `form_payload (jsonb)`, `token_tier` |
| `character_batches` | `user_id`, `storyline_id`, `name`, `reference_image_url`, `reference_image_urls (text[])`, `prop_image_url`, `character_description`, `status`, `image_count`, `aspect_ratio` |
| `generated_images` | `user_id`, `batch_id (FK→character_batches, CASCADE)`, `url`, `label`, `category` |
| `character_drafts` | `user_id`, all identity/personality/appearance/image-generation fields, `creation_status`, timestamps |
| `characters` | `user_id`, full character record (mirrors drafts), `character_manifest (text)`, `image_history (jsonb)`, `draft_id (FK→character_drafts)`, immutable after finalization |
| `stripe_events` | `id (PK = Stripe event ID)`, `type`, `data (jsonb)`, `processed_at` |

### RLS

All user-data tables have Row-Level Security enabled with `auth.uid() = user_id` policies (select/insert/update/delete own data). `tiers` has public read. `stripe_events` is service-role only.

### Key RPCs

| Function | Description |
|---|---|
| `increment_usage(p_user_id, p_type, p_period, p_amount)` | Atomic upsert on `usage` table — safe for concurrent calls |
| `sync_tier_from_subscription(...)` | Called by webhook handler to update `profiles.tier_id` based on Stripe subscription state |

---

## Authentication & Authorization

- Supabase Auth (email/password + Google OAuth)
- JWT auto-attached by `supabase.functions.invoke()` for all edge function calls
- Edge functions verify JWTs server-side
- `profiles` row auto-created on `auth.users` insert via `handle_new_user()` trigger
- All pages wrapped in `ProtectedRoute` — unauthenticated users see a non-dismissible login modal
- `TOKEN_REFRESHED` events handled specially in `AuthContext` to avoid re-mounting in-flight generation pages

---

## Usage Limiting

Limits are enforced in two places:

1. **Client-side** (`AuthContext.checkLimit`): prevents unnecessary API calls with a fast local check
2. **Server-side** (each edge function `checkLimit()`): authoritative — returns HTTP 429 on breach

`LimitError` is thrown client-side on HTTP 429, caught at the generation loop level to halt with a toast.

Tier defaults:

| Tier | Monthly Images | Monthly Stories | Daily Images | Daily Stories |
|---|---|---|---|---|
| Free | 15 | 3 | — | — |
| Pro | 100 | 20 | — | — |
| Enterprise | unlimited | unlimited | 100 | 25 |

> **Note**: Daily limits (Enterprise) are defined in the `tiers` table but the client-side `checkLimit` only tracks monthly counts. Daily enforcement requires a separate daily counter — not yet implemented client-side.

---

## Stripe Billing Integration

### Setup Steps

1. **Create products and prices** in the [Stripe Dashboard](https://dashboard.stripe.com/products):
   - Pro: monthly recurring, e.g. $9.99/mo
   - Enterprise: monthly recurring, e.g. $29.99/mo

2. **Populate `stripe_price_id`** in the `tiers` table:
   ```sql
   UPDATE tiers SET stripe_price_id = 'price_YOUR_PRO_PRICE_ID'    WHERE id = 'pro';
   UPDATE tiers SET stripe_price_id = 'price_YOUR_ENT_PRICE_ID'    WHERE id = 'enterprise';
   ```

3. **Set Supabase secrets**:
   ```bash
   supabase secrets set STRIPE_SECRET_KEY=sk_live_...
   supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
   supabase secrets set APP_URL=https://your-app.com
   ```

4. **Register the webhook** in Stripe Dashboard:
   - URL: `https://<project-ref>.supabase.co/functions/v1/stripe-webhook`
   - Events: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_succeeded`, `invoice.payment_failed`

5. **Deploy the edge functions**:
   ```bash
   supabase functions deploy stripe-checkout
   supabase functions deploy stripe-webhook
   ```

6. **(Optional)** Set up the [Stripe Customer Portal](https://dashboard.stripe.com/settings/billing/portal) and deploy the `stripe-portal` edge function for self-serve subscription management.

---

## Environment Variables

Create `.env` from `.env.example`:

```env
# Supabase — get from: Supabase Dashboard → Project Settings → API
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_...   # or eyJ... (legacy anon key)
```

**Supabase Edge Function Secrets** (set via `supabase secrets set` — never in `.env`):

```
CharacterForge         Supabase admin key for anthropic-proxy, fal-generate*, fal-rembg (sb_secret_...)
SUPABASE_SERVICE_ROLE_KEY  Standard service-role key for stripe-checkout, stripe-webhook (eyJ...)
ANTHROPIC_KEY          Anthropic API key (sk-ant-...)
FAL_KEY                fal.ai API key (uuid:uuid format)
STRIPE_SECRET_KEY      Stripe secret key (sk_live_... or sk_test_...)
STRIPE_WEBHOOK_SECRET  Stripe webhook signing secret (whsec_...)
APP_URL                Deployed app base URL (e.g. https://your-app.vercel.app)
```

---

## Local Development

### Prerequisites

- Node.js 20+
- [Supabase CLI](https://supabase.com/docs/guides/cli)
- A Supabase project (free tier is sufficient for development)

### Steps

```bash
# 1. Clone and install
git clone <repo-url>
cd character-forge
npm install

# 2. Configure environment
cp .env.example .env
# Fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY

# 3. Run database migrations
# Option A: using Supabase CLI
supabase db push

# Option B: run manually in Supabase SQL Editor in this order:
#   supabasemigrations/20260316_character_generate_feature.sql  (creates character_drafts + characters)
#   supabase/migrations/001_initial_schema.sql
#   supabase/migrations/002_rpc_increment_usage.sql
#   supabase/migrations/004_stripe_billing.sql
#   supabase/migrations/005_character_generate_feature.sql
#   supabase/migrations/006_add_character_columns.sql

# 4. Deploy edge functions (requires Supabase project linked)
supabase functions deploy anthropic-proxy --no-verify-jwt
supabase functions deploy fal-generate --no-verify-jwt
supabase functions deploy fal-generate-character --no-verify-jwt
supabase functions deploy fal-rembg --no-verify-jwt

# 5. Set edge function secrets
supabase secrets set CharacterForge=sb_secret_...
supabase secrets set ANTHROPIC_KEY=sk-ant-...
supabase secrets set FAL_KEY=...

# 6. Start development server
npm run dev
```

The app runs on `http://localhost:5173` by default.

---

## Deployment

The project is a standard Vite SPA. Build output goes to `dist/`.

```bash
npm run build
```

**Recommended platforms**: Vercel, Netlify, Cloudflare Pages.

A `vercel.json` is included with SPA rewrite rules and build config.

After deploying:
1. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as environment variables on the host.
2. Add your deployment URL to Supabase Auth's allowed redirect URLs.
3. Set `APP_URL` secret on Supabase Edge Functions: `supabase secrets set APP_URL=https://your-app.vercel.app`
4. Register the Stripe webhook pointing to your Supabase project functions URL.
