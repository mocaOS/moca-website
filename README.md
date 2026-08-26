# Museum of Crypto Art — museumofcryptoart.com

The public website of the **[Museum of Crypto Art](https://museumofcryptoart.com)** (MOCA): browse the permanent collections, build and walk immersive 3D exhibitions, study the writings and crypto-art timeline, and talk to the **Library** — a live, anonymous chat over MOCA's **[Cortex](https://cortex.eco)** knowledge engine.

This repository is the culmination of years of MOCA tooling, extracted into a standalone, self-contained app. Built with **Next.js 16** (App Router, standalone output), **React 19**, **Tailwind CSS 4**, **react-three-fiber** for 3D, and **wagmi/viem + Reown AppKit** for web3.

- **Dev / container port:** `3331`
- **Canonical site URL:** `https://museumofcryptoart.com`
- **Library backend:** [Cortex](https://cortex.eco) — agentic RAG (knowledge graph + streaming chat), reached only server-side through this app's proxy. See [docs.cortex.eco](https://docs.cortex.eco).
- **CMS:** Directus (collections, NFTs, rooms) — read live, server-side.

---

## What's inside

| Route | What it is | Data source |
|---|---|---|
| `/` | Museum home — hero, featured collections, mission | Directus |
| `/collections` · `/collections/[slug]` | The permanent collection — masonry grid, search/filter, lightbox, curatorial essays | Directus |
| `/rooms` · `/rooms/[id]` | MOCA ROOMs — immersive 3D rooms (GLB) in a fullscreen R3F viewer | Directus |
| `/rooms/world` | **3D exhibition world builder** — place rooms on a grid, hang/curate artworks (from the museum collections or a wallet's legacy Multipass curations), save exhibits locally, export, and **spawn into [Hyperfy](https://github.com/hyperfy-xyz/hyperfy) worlds** (rooms, artworks, and an agentic museum-guide avatar) | Directus + localStorage |
| `/library` | **Public** Cortex chat — streaming answers, citations, source viewer | Cortex (server proxy) |
| `/library/review` | Admin review queue for community document submissions (SIWE-gated) | Directus + Cortex |
| `/writings` · `/timeline` · `/incubator` | Curated reading list, crypto-art history, Incubator program | Static (`src/content`) |
| `/manifesto` · `/press-room` · `/moca-live` · `/cortex` · `/decc0s` · `/soulweaver` | Content & program pages | Static |
| `/unstake` | Withdrawal UI for the legacy $MOCA staking pools (Polygon) | On-chain |
| `/llms.txt` | Agent-first site map | Generated |

The whole museum is **anonymous by default** — no accounts, no database. Web3 login (SIWE) exists only for community document submissions, the admin review queue, and the holder account view (holdings + personal Library API keys).

---

## Architecture

```
 Browser
   │  (never sees any API key)
   ├─ /collections /rooms ───── React Server Components ──► Directus REST
   ├─ artwork media ──────────────────────────────────────► transform proxy / IPFS gateway (fallbacks)
   ├─ /rooms/world ── R3F world builder ──► /api/museum/* (artworks, previews, model, texture, multipass)
   ├─ /writings /timeline /incubator ── static JSON in the bundle
   └─ /library ── /api/ask/stream (SSE proxy) ──► Cortex API
                    └─ injects X-API-Key server-side, strips gzip so tokens stream
```

- **Cortex is reached only through the server** (`/api/ask/stream`, `/api/proxy/*`). A single read-only key (`CORTEX_API_KEY`) powers the anonymous public Library; it never reaches the browser.
- **Galleries/rooms render server-side** from Directus (`src/lib/museum/directus.ts`) — SEO-friendly, no client credentials.
- **Media** (`src/lib/museum/media.ts`) routes images/videos through a transform proxy with IPFS-gateway fallbacks; many legacy `openseauserdata.com` source URLs are dead at origin but revived from cache.
- **3D pipeline** (`src/lib/museum/hyperfy/`, `/api/museum/model|texture`): room GLBs are recompressed on the fly (WebP textures, decoded geometry) and exhibition exports can be spawned into self-hosted Hyperfy v2 worlds — including an agentic, voice-enabled museum guide.
- **No database.** Exhibits live in the visitor's localStorage; the submission review queue lives in Directus; personal Library keys live in Cortex's key store. The container is stateless.

---

## Getting started

### Prerequisites

- Node.js 22+
- Optionally: a read-only **Cortex API key** (`cortex_ro_…`) for the Library

### Install & run (dev)

```bash
npm install
cp .env.example .env       # then fill in what you need (see below)
npm run dev                # http://localhost:3331
```

> The museum boots **without any keys** — collections, rooms, world builder, writings, and timeline all work. Each integration (Library chat, submissions, wallet holdings) simply reports "not configured" until its env is set.

---

## Environment variables

All secrets are **server-only, read at runtime**; only `NEXT_PUBLIC_*` values are inlined at build. `.env.example` documents every variable — the important ones:

| Variable | Purpose |
|---|---|
| `CORTEX_API_URL` / `CORTEX_API_KEY` | Cortex backend + single read-only key for the public Library. Unset → Library disabled, site still runs. |
| `CORTEX_MANAGEMENT_API_KEY` | Write-capable (`cortex_rw_`) key used **only** to ingest approved community submissions. |
| `CORTEX_ADMIN_API_KEY` | Admin-tier key that mints/revokes per-holder read-only Library API keys. |
| `DIRECTUS_URL` | Directus CMS (collections, NFTs, rooms). |
| `DIRECTUS_SUBMISSIONS_TOKEN` | Static token scoped to the `library_submissions` collection — the app's only Directus writer. |
| `IPFS_GATEWAY` / `IPFS_FALLBACK_GATEWAY` | Media gateways for `ipfs://` URIs. |
| `NEXT_PUBLIC_SITE_URL` | Canonical base URL for SEO/OG. **Build-time inlined.** |
| `NEXT_PUBLIC_REOWN_PROJECT_ID` | Reown AppKit project id (wallet connect modal). Public value. |
| `SESSION_SECRET` | HMAC secret for the SIWE session cookie (`openssl rand -hex 32`). Unset → sign-in disabled. |
| `LIBRARY_ADMIN_ADDRESSES` | Comma-separated ETH addresses allowed to review/approve submissions. |
| `MORALIS_API_KEY` | Lists NFT holdings (Art DeCC0s + MOCA ROOMs) in the account view. |
| `ETH_RPC_URL` / `POLYGON_RPC_URL` | JSON-RPC endpoints for $MOCA balances / staking reads (public fallbacks exist). |

> **Never** prefix a secret with `NEXT_PUBLIC_`.

---

## Build & run (production)

The app uses Next's **`output: "standalone"`**:

```bash
npm run build
PORT=3331 node --env-file=.env .next/standalone/server.js
```

### Docker

The multi-stage `Dockerfile` builds the standalone output and runs it as a non-root user on port **3331**. The container is **stateless** — no volumes needed.

```bash
docker build -t moca-museum .
docker run -p 3331:3331 --env-file .env moca-museum
```

### docker-compose / Coolify / Dokploy

`docker-compose.yml` is the deployment target for managed platforms:

1. Create a Docker Compose resource pointing at this repo (build context is the repo root).
2. Set the environment variables (all runtime except `NEXT_PUBLIC_*`).
3. Point your domain (e.g. `museumofcryptoart.com`) at container port **3331**; the platform's proxy terminates TLS.
4. Deploy — the public site is immediately live; each integration activates as soon as its env is present.

```bash
docker compose up -d --build
```

---

## Content management

- **Collections, NFTs, rooms** are live from **Directus** — edit in the CMS, changes appear immediately.
- **Writings, Timeline, Incubator** are static JSON under `src/content/` — edit and redeploy.
- **Community submissions**: web3 users submit documents/URLs for the Library; whitelisted admins approve them at `/library/review`, which ingests them into the Cortex "Collective" collection.

---

## Project structure

```
src/
├── app/
│   ├── (site)/                 # public museum chrome — home, collections, rooms index,
│   │   │                       #   writings, timeline, incubator, manifesto, press-room,
│   │   │                       #   moca-live, cortex, decc0s, soulweaver, unstake
│   ├── (fullscreen)/rooms/     # 3D room viewer + the world builder (/rooms/world)
│   ├── library/                # public Cortex chat + /library/review (admin queue)
│   ├── api/
│   │   ├── ask/stream/         # SSE Cortex proxy (key injected server-side)
│   │   ├── proxy/[...path]/    # generic Cortex read proxy
│   │   ├── museum/             # artworks, collections, previews, multipass,
│   │   │                       #   model (GLB optimizer), texture (HQ proxy)
│   │   ├── auth/               # SIWE (nonce, verify, session, logout)
│   │   ├── library/submissions/  # submit + approve/reject queue
│   │   ├── holdings/ keys/ stakes/  # web3 account surfaces
│   └── llms.txt/               # agent-first site map
├── components/
│   ├── site/                   # SiteHeader, SiteFooter
│   ├── museum/                 # gallery grid, lightbox, rooms browser, …
│   │   └── three/              # Room3DViewer, WorldBuilder, Hyperfy spawn dialog
│   ├── wallet/                 # Reown AppKit provider, SIWE login
│   └── …                       # Library chat UI
├── content/                    # static JSON: writings, timeline, incubator
└── lib/
    ├── museum/                 # directus.ts (data layer), media.ts, hyperfy/ (spawner,
    │                           #   wire protocol, room/guide scripts, .hyp builder)
    ├── library/                # submissions + Cortex management client
    └── web3/                   # holdings, staking reads
scripts/                        # one-off utilities (room optimization, scrapers)
```

---

## Notes & caveats

- **`openseauserdata.com` is shut down.** Affected artworks are revived via the media transform proxy; the raw URL is the fallback.
- **3D is client-only.** The R3F viewer/world builder are dynamically imported with `ssr: false`.
- **Hyperfy spawning** targets self-hosted [Hyperfy](https://github.com/hyperfy-xyz/hyperfy) v2 worlds (pinned wire protocol v0.16.0) — a world URL + admin key is all it takes.

## Tech stack

Next.js 16 · React 19 · TypeScript 5 · Tailwind CSS 4 · @react-three/fiber + drei + three.js · @directus/sdk · wagmi + viem + Reown AppKit · Moralis · gltf-transform + sharp (server-side GLB/texture optimization) · msgpackr (Hyperfy wire protocol) · react-markdown + remark-gfm · Docker (standalone output).
