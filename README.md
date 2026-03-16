# Character Forge

AI-powered character image generation and storyline creation tool for writers, game developers, and creators. Built with React, Vite, Supabase, Anthropic Claude, and fal.ai.

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
- **Create structured storyline prompts** from detailed narrative inputs.
- **Organize characters and storylines** into folders/collections.
- **Export** character image sets as ZIP archives.
- **Manage account subscriptions** via Stripe.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend framework | React 19 + Vite 8 |
| Routing | React Router DOM 7 |
| State / Data fetching | TanStack React Query 5 |
| UI styling | Tailwind CSS 4 |
| Icons | Lucide React 0.577 |
| Notifications | Sonner 2 |
| Backend / Auth / DB | Supabase (Postgres + Edge Functions + Auth) |
| LLM | Anthropic Claude (claude-sonnet-4-5 / claude-opus-4-5) |
| Image generation | fal.ai (nano-banana-2/edit) |
| Background removal | fal.ai (imageutils/rembg) |
| Billing | Stripe Checkout + Webhooks |
| Package manager | npm |

---

## Project Structure

```
character-forge/
├── public/                     # Static assets
├── src/
│   ├── App.jsx                 # Root router — route definitions
│   ├── main.jsx                # React entry point, context providers
│   ├── index.css               # Global styles, Tailwind base
│   ├── assets/                 # Images, fonts
│   ├── contexts/
│   │   ├── AuthContext.jsx     # Auth state, profile, tier, usage
│   │   ├── ThemeContext.jsx    # Genre-based visual theming
│   │   └── ProgressContext.jsx # Global generation progress bar
│   ├── components/
│   │   ├── Layout.jsx          # Nav bar, progress bar, auth area
│   │   ├── AuthModal.jsx       # Login / register / forgot password modal
│   │   └── ProtectedRoute.jsx  # Route guard; shows AuthModal if unauthenticated
│   ├── pages/
│   │   ├── Generate.jsx        # Main character generation workflow (Step 1 + Step 2)
│   │   ├── Gallery.jsx         # Storyline and batch library overview
│   │   ├── BatchDetail.jsx     # Individual character batch — images, edit, restyle
│   │   ├── StorylineDetail.jsx # Single storyline — characters, group shots
│   │   ├── StorylineForm.jsx   # Multi-section storyline prompt builder
│   │   ├── StorylineResult.jsx # Rendered storyline prompt output
│   │   └── Settings.jsx        # Account, plan, usage, billing, security
│   └── lib/
│       ├── supabase.js         # Supabase client factory
│       ├── anthropic.js        # AI API wrappers (callLLM, generateImage, removeImageBackground)
│       ├── storage.js          # Supabase data-layer: Storyline, CharacterBatch, GeneratedImage, …
│       ├── stripe.js           # Stripe checkout and portal redirect helpers
│       └── seedSettings.js     # Legacy settings seed (no-op in production)
├── supabase/
│   ├── functions/
│   │   ├── anthropic-proxy/    # Edge Function: LLM proxy with auth + rate limiting
│   │   ├── fal-generate/       # Edge Function: fal.ai image generation proxy
│   │   ├── fal-rembg/          # Edge Function: fal.ai background removal proxy
│   │   ├── stripe-checkout/    # Edge Function: Stripe Checkout Session creation
│   │   └── stripe-webhook/     # Edge Function: Stripe webhook handler
│   └── migrations/
│       ├── 001_initial_schema.sql      # Tables, RLS, triggers, seed data
│       ├── 002_rpc_increment_usage.sql # Atomic usage counter upsert RPC
│       ├── 003_admin_helpers.sql       # Manual admin SQL snippets (comments only)
│       └── 004_stripe_billing.sql      # Stripe customer/subscription columns + sync function
├── .env.example                # Required environment variable template
├── vite.config.js
├── tailwind.config.js
└── package.json
```

---

## Architecture

```
Browser (React SPA)
    │
    ├─── React Router → pages (Generate, Gallery, BatchDetail, …)
    │
    ├─── TanStack Query → caches Supabase data
    │
    ├─── AuthContext → Supabase Auth session + profile
    │
    └─── lib/anthropic.js ──► supabase.functions.invoke()
                                     │
                     ┌───────────────┼────────────────────┐
                     ▼               ▼                    ▼
              anthropic-proxy   fal-generate          fal-rembg
              (Claude API)      (fal.ai nano-banana)  (fal.ai rembg)
                     │               │
                     └───── increment_usage RPC ──► Postgres usage table
```

All AI API keys (`ANTHROPIC_KEY`, `FAL_KEY`, `STRIPE_SECRET_KEY`) are stored exclusively as Supabase Edge Function secrets and are never exposed to the browser.

---

## Pages & Features

### `Generate.jsx` — Character Image Generation

**Step 1 — Storyline Selection**
- **New Storyline**: Name input, images-per-character slider (1–20), genre picker, keep-integrity toggle, art style selector.
- **Existing Storyline**: Select from user's saved storylines.
- **Recent Characters**: Last 5 characters displayed below the Existing Storyline button for quick resume of in-progress work. Clicking navigates directly to the character's batch detail page.

**Step 2 — Character Configuration**
Each `CharacterSlot` supports:
- Multi-image source upload (multiple reference angles; primary labelled)
- Character name, archetypes (28 options), character arc textarea
- Keep Integrity / Remove Background toggles
- Shot type (Portrait / Half-body / Full-body) and aspect ratio (10 options: 21:9 → 9:16)
- Held items toggle with prop reference image upload
- Layer overrides: Pose, Expression, Outfit (preset chips + custom tags)
- Live preview grid showing images as they complete, with pending placeholder cells matching the actual expected count
- Failed images panel with per-image retry buttons

**Generation Pipeline (`handleForge`)**
1. Creates storyline in DB if new
2. Per character:
   - Phase 1: Claude analyzes all reference images → detailed character description
   - Phase 2: Claude generates N pose/emotion variation objects (JSON)
   - Creates `CharacterBatch` record in DB
   - Per variation: `fal-generate` → optional `fal-rembg` → `GeneratedImage.create` → live preview update
   - Failed images tracked with full prompt + reference URLs for retry

---

### `Gallery.jsx` — Library Overview

- Lists all storylines with 2×2 image previews and character counts
- Lists unassigned character batches
- Actions: Create storyline, assign batch to storyline, delete (with cascade warning)

---

### `BatchDetail.jsx` — Character Batch Detail

**Image Grid**
- Dynamic aspect ratio display — images render at their natural proportions, no center-cropping
- Hover overlay shows image label

**Actions**
- **Select**: Bulk mode for multi-image delete
- **Move**: Assign to a different storyline
- **Export**: Download all or selected as ZIP (via JSZip from esm.sh CDN)
- **Restyle**: Apply a new art style — creates new image records (originals preserved)
- **Add**: Generate a new pose/emotion variation — rembg applied if batch had it enabled
- **Add Prop**: Generate a variation with a prop — rembg applied, reference_image_urls used
- **Delete**: Delete batch and all images

**Image Edit Modal**
- Click an image → modal with label, category, describe-changes textarea
- Click the image within the modal → **lightbox** (full-resolution, zoom-in view)
- **Regenerate**: Creates a new image record with rembg applied; original is preserved
- **Download**: Direct download of the image file

**Analysis Panel**
- Collapsible accordion showing the Claude character description used for generation
- Persists across sessions (stored in `character_batches.character_description`)

**Reference Images**
- Batch stores both `reference_image_url` (primary) and `reference_image_urls` (all source images)
- All generation operations (add variation, add prop, regenerate) prefer the full `reference_image_urls` array for better consistency

---

### `StorylineDetail.jsx` — Storyline View

- Lists all character batches in the storyline
- Group Shot: generates multi-character scene images
- Add Characters: navigates to `/generate?storylineId=...`
- Delete storyline (characters unassigned, not deleted)

---

### `StorylineForm.jsx` — Storyline Prompt Builder

Multi-section form:
- Section A: World & protagonist (genre chips, opening situation, protagonist, NPCs, factions, power systems)
- Section B: Narrative physics (structural overlays, power fantasy ratio, moral complexity, hooks)
- Token tier selection (Lite / Standard / Rich) controlling Claude's max tokens
- Output saved to `storyline_prompts` table

---

### `StorylineResult.jsx` — Prompt Output

- Displays parsed Section A / B / C from stored prompt
- Per-section copy buttons, Copy All, Save to Folder, Retry, Start Over

---

### `Settings.jsx` — Account Settings

**Profile**: Display name, email (read-only)
**Plan & Usage**:
- Current plan badge with usage bars (images, storylines)
- Pricing cards for Free / Pro / Enterprise with feature lists
- Upgrade button → Stripe Checkout (via `stripe-checkout` edge function)
- Manage Billing button → Stripe Customer Portal (for users with active subscriptions)
**Security**: Password change (Supabase auth)

---

## Components

### `Layout.jsx`
Fixed navigation bar with:
- Logo with genre-themed gradient
- Navigation links: Generate Images, Generate Storyline, Gallery, Settings
- Auth area: tier badge, usage display, Sign Out (authenticated) or Sign In button (guest)
- Global progress bar (indeterminate scan or fraction) with Stop button
- Sonner `<Toaster>` for toast notifications

### `AuthModal.jsx`
Three-mode modal: `login`, `register`, `forgot`
- Email/password with show/hide toggle
- Google OAuth
- Display name collection on register

### `ProtectedRoute.jsx`
- Blocks unauthenticated access: blurred placeholder + non-dismissible AuthModal overlay
- Shows loading spinner while auth state resolves

---

## Context Providers

### `AuthContext.jsx`

| Export | Type | Description |
|---|---|---|
| `user` | `Object\|null` | Supabase auth user |
| `profile` | `Object\|null` | `profiles` row including `stripe_customer_id`, `stripe_subscription_status` |
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
| `refreshProfile()` | `Function` | Re-fetch profile, tier, usage |

### `ThemeContext.jsx`

Provides `{ theme, genreKey, setGenreKey, GENRES }`. Eight genre themes: `default`, `noir`, `fantasy`, `cyberpunk`, `romance`, `horror`, `anime`, `adventure`. Genre preference persisted in `localStorage` under `cf_genre`.

### `ProgressContext.jsx`

Provides global generation progress bar state:

| Export | Description |
|---|---|
| `progress` | `{label, current, total, taskRoute}\|null` — `total=null` for indeterminate |
| `startProgress(label, total, route)` | Begin a tracked operation |
| `updateProgress(current)` | Update current step count |
| `setProgressLabel(label)` | Update the display label |
| `clearProgress()` | Clear and hide the progress bar |
| `stopProgress(onStop)` | Stop + run optional callback |
| `isCancelled()` | Synchronous cancellation check (ref-based, not state) |

---

## Library Modules

### `src/lib/supabase.js`

Creates and exports the Supabase client. Reads `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from environment. Throws on missing values.

### `src/lib/anthropic.js`

All AI calls are proxied through Supabase Edge Functions. No API keys in the browser.

| Function | Description |
|---|---|
| `callLLM({ prompt, imageUrls, responseSchema, generationType })` | Claude claude-sonnet-4-5 call; JSON-parses if `responseSchema` provided |
| `callStorylineAPI({ formPayload, maxTokens })` | Claude claude-opus-4-5 for rich storyline generation |
| `generateImage({ prompt, referenceImageUrls, referenceImageUrl, propImageUrl, aspectRatio })` | fal.ai nano-banana-2 image generation; returns URL |
| `removeImageBackground(imageUrl)` | fal.ai rembg background removal; returns URL |
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
- `list(userId)` — All batches, newest first
- `get(id)` — Single batch
- `create(userId, data)` — Returns created record. Key fields: `name`, `storyline_id`, `reference_image_url`, `reference_image_urls[]`, `character_description`, `status`, `image_count`, `aspect_ratio`
- `update(id, data)` — Partial update
- `delete(id)`
- `forStoryline(storylineId)` — Batches in a storyline, newest first
- `assignStoryline(batchId, storylineId)` — Assign or unassign (`null`)

**`GeneratedImage`**
- `list(userId)` — All images for user
- `get(id)` — Single image
- `create(userId, data)` — Returns created record. Key fields: `batch_id`, `url`, `label`, `category`
- `update(id, data)` — Partial update
- `delete(id)`
- `filter({ batch_id }, orderBy, limit)` — Filtered list for a batch

**`StorylinePrompt`**
- `get(id)`, `create(userId, data)`, `update(id, data)`, `delete(id)`

### `src/lib/stripe.js`

| Function | Description |
|---|---|
| `redirectToCheckout(priceId)` | Calls `stripe-checkout` edge function; redirects browser to Stripe-hosted checkout |
| `redirectToCustomerPortal()` | Calls `stripe-portal` edge function; redirects to Stripe Customer Portal |

---

## Supabase Edge Functions

All edge functions are Deno TypeScript and live in `supabase/functions/`.

### `anthropic-proxy`

**Route**: `POST /functions/v1/anthropic-proxy`

Proxies requests to the Anthropic Messages API.

1. Validates `Authorization: Bearer <JWT>`
2. Checks usage limits via `profiles + tiers + usage` query
3. Forwards request body to `https://api.anthropic.com/v1/messages` using `ANTHROPIC_KEY`
4. On 2xx: calls `increment_usage` RPC
5. HTTP 429 returned if user is at monthly/daily limit

**Required secrets**: `ANTHROPIC_KEY`

---

### `fal-generate`

**Route**: `POST /functions/v1/fal-generate`

Proxies image generation requests to `fal-ai/nano-banana-2/edit`.

1. JWT auth + image usage limit check
2. Validates `image_urls` (min 1 required)
3. Calls fal.ai in `sync_mode: true`
4. On success: `increment_usage` RPC
5. Returns `{ images: [{ url }] }`

**Required secrets**: `FAL_KEY`

---

### `fal-rembg`

**Route**: `POST /functions/v1/fal-rembg`

Proxies background removal requests to `fal-ai/imageutils/rembg`.

1. JWT auth (no usage counting)
2. Calls fal.ai in `sync_mode: true`
3. Returns `{ image: { url } }`

**Required secrets**: `FAL_KEY`

---

### `stripe-checkout`

**Route**: `POST /functions/v1/stripe-checkout`

Creates a Stripe Checkout Session for subscription upgrades.

**Request body**: `{ priceId: string }`
**Response**: `{ url: string }` — Stripe-hosted checkout page URL

1. JWT auth
2. Retrieves or creates Stripe customer for the user (persists `stripe_customer_id` to `profiles`)
3. Creates Checkout Session in `subscription` mode
4. Returns session URL for browser redirect

**Required secrets**: `STRIPE_SECRET_KEY`, `APP_URL`

---

### `stripe-webhook`

**Route**: `POST /functions/v1/stripe-webhook`

Handles Stripe webhook events. Register this URL in the Stripe Dashboard.

**Handled events**:
- `checkout.session.completed` — Activates subscription post-purchase
- `customer.subscription.created` / `updated` — Syncs tier via `sync_tier_from_subscription` RPC
- `customer.subscription.deleted` — Downgrades user to Free
- `invoice.payment_failed` — Marks subscription as `past_due`
- `invoice.payment_succeeded` — Confirms `active` status

Implements HMAC-SHA256 signature verification and idempotency via `stripe_events` table.

**Required secrets**: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`

---

## Database Schema

### Tables

| Table | Key Columns |
|---|---|
| `tiers` | `id (PK)`, `display_name`, `monthly_image_limit`, `monthly_story_limit`, `daily_image_limit`, `daily_story_limit`, `stripe_price_id`, `stripe_product_id`, `price_monthly_cents`, `features[]` |
| `profiles` | `id (FK→auth.users)`, `email`, `display_name`, `tier_id (FK→tiers)`, `stripe_customer_id`, `stripe_subscription_id`, `stripe_subscription_status`, `subscription_period_end` |
| `usage` | `user_id`, `type (image\|story)`, `period (date)`, `count`. Unique on `(user_id, type, period)` |
| `storylines` | `user_id`, `name`, `storyline_art_style`, `storyline_prompt_id`, `storyline_metadata (jsonb)` |
| `storyline_prompts` | `user_id`, `storyline_id`, `raw_response`, `section_a`, `section_b`, `section_c`, `form_payload (jsonb)`, `token_tier` |
| `character_batches` | `user_id`, `storyline_id`, `name`, `reference_image_url`, `reference_image_urls (text[])`, `prop_image_url`, `character_description`, `status`, `image_count`, `aspect_ratio` |
| `generated_images` | `user_id`, `batch_id (FK→character_batches, CASCADE)`, `url`, `label`, `category` |
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
- Edge functions verify JWTs server-side using the service role client
- `profiles` row auto-created on `auth.users` insert via `handle_new_user()` trigger
- All pages wrapped in `ProtectedRoute` — unauthenticated users see a non-dismissible login modal

---

## Usage Limiting

Limits are enforced in two places:

1. **Client-side** (`AuthContext.checkLimit`): prevents unnecessary API calls
2. **Server-side** (each edge function `checkLimit()`): authoritative — returns HTTP 429 on breach

`LimitError` is thrown client-side on HTTP 429, caught at the generation loop level to halt with a toast.

Tier defaults:

| Tier | Monthly Images | Monthly Stories | Daily Images | Daily Stories |
|---|---|---|---|---|
| Free | 15 | 3 | — | — |
| Pro | 100 | 20 | — | — |
| Enterprise | unlimited | unlimited | 100 | 25 |

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

6. **(Optional)** Set up the [Stripe Customer Portal](https://dashboard.stripe.com/settings/billing/portal) and deploy `stripe-portal` edge function for self-serve subscription management.

---

## Environment Variables

Create `.env` from `.env.example`:

```env
# Supabase
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...

# Optional: legacy API key seed (not used in production)
VITE_ANTHROPIC_KEY=
VITE_FAL_KEY=
```

**Supabase Edge Function Secrets** (set via `supabase secrets set` — never in `.env`):

```
ANTHROPIC_KEY         Anthropic API key
FAL_KEY               fal.ai API key
STRIPE_SECRET_KEY     Stripe secret key (sk_live_... or sk_test_...)
STRIPE_WEBHOOK_SECRET Stripe webhook signing secret (whsec_...)
APP_URL               Deployed app base URL (e.g. https://your-app.vercel.app)
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
supabase db push
# Or manually run each migration in the Supabase SQL Editor

# 4. Deploy edge functions (requires Supabase project linked)
supabase functions deploy anthropic-proxy
supabase functions deploy fal-generate
supabase functions deploy fal-rembg

# 5. Set edge function secrets
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

After deploying:
1. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as environment variables on the host.
2. Add your deployment URL to Supabase Auth's allowed redirect URLs.
3. Set `APP_URL` secret on Supabase Edge Functions.
4. Register the Stripe webhook pointing to your Supabase project functions URL.
