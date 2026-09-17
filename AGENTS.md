<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Project map

Sambike Ads is a Slovak campaign landing-page and lead-capture app with an internal campaign/lead administration area.

- Stack: Next.js 16 App Router, React 19, Tailwind CSS 4, Prisma 7 and PostgreSQL 17 (Docker Compose locally).
- Campaign mutations and public lead submission live in `app/actions.ts`; authorized CRM mutations live in `app/crm-actions.ts`; the public landing page is `app/kampan/[slug]/page.tsx`.
- Prisma schema and PostgreSQL migrations live under `prisma/`; historical SQLite migrations are read-only under `prisma/legacy-sqlite-migrations/`. The generated client is committed under `generated/prisma/` and must be refreshed with `npm run db:generate` after schema edits.
- Admin authentication is centralized in `lib/admin-auth.ts`, with optimistic page protection in `proxy.ts`; every admin server action and API mutation must still call the server-side guard. Login and lead throttling use PostgreSQL `RateLimitBucket`, not process memory.
- Public lead validation/protection lives in `lib/lead-validation.ts`, `lib/lead-protection.ts` and `lib/turnstile.ts`. Lead creation and its `EmailOutbox` records are one transaction; delivery/retry is in `lib/email-outbox.ts` and `POST /api/email-outbox`.
- CRM source-of-truth models are `Lead`, append-only `LeadActivity`, and `CampaignEvent`. Completed value is integer cents, audit activity must not copy contact details, and dashboard lead counts come from stored `Lead` rows rather than client events.
- Daily Meta history is `MetaDailyMetric`; manual and cron sync upsert on `(metaAdCampaignId, date)`. `POST /api/cron/meta-sync` requires the same `CRON_SECRET` mechanism as the outbox worker.
- Campaign lifecycle uses `Campaign.status` (`DRAFT`, `READY`, `PUBLISHED`, `PAUSED`, `ARCHIVED`); `isActive` no longer exists. Publishing must pass `campaignReadiness`, creates `CampaignPublication`, and is recorded in `CampaignAudit`. Scheduled transitions run through `POST /api/cron/campaigns` using `CRON_SECRET`; admin times are Europe/Bratislava.
- Draft preview links are campaign-scoped HMAC tokens valid for 15 minutes and must keep analytics and lead submission disabled. One A/B experiment per campaign stores variant A/B on `CampaignEvent` and `Lead`.
- Meta defaults to `META_MODE=sandbox`, which never creates or activates remote objects. Live activation requires a current verification for the selected account/mode, EUR, a published landing page, explicit confirmation, and both configured budget limits.
- Uploaded campaign media is validated in `lib/campaign-media.ts`; local development stores files under `storage/campaign-images/`, while production uses Cloudflare R2 with `CAMPAIGN_MEDIA_STORAGE="r2"` and the `R2_*` environment variables. All selected campaign media uploads unmodified from the browser to presigned R2 URLs created by `app/api/campaign-media-upload/route.ts`, avoiding hosting request-size limits. Limits shared by client and server live in `lib/campaign-media-limits.ts`. The R2 bucket must allow browser `PUT` requests from the production origin through CORS. Media is served through `app/uploads/[filename]/route.ts` with image/video content types and byte ranges.
- The admin media library is derived from `/uploads/` URLs already referenced by campaigns, sections, experiments and gallery items; it has no separate ownership table because the app currently has one shared administrator. Reused gallery media must be submitted as `galleryLibraryMedia` so failure cleanup never deletes an existing shared file.
- Hero and offer images remain fallback campaign fields. `CampaignGalleryItem` is the editable media source: each item has a caption, global order and `GALLERY`, `HERO`, `OFFER`, `BEFORE` or `AFTER` placement. Only images may occupy a special placement and the server keeps at most one item in each; MP4 stays in the gallery.
- Landing-page composition is stored in ordered `CampaignSection` rows (`type`, `position`, `isVisible`, JSON `content`). `lib/campaign-sections.ts` owns validation and the fallback projection from legacy campaign columns; section saves also update legacy fields needed by SEO, A/B testing and integrations. Gallery media can point to its owning section through nullable `CampaignGalleryItem.sectionId`.
- Verification commands: `npm test`, `npm run lint`, `npx tsc --noEmit`, and `npm run build`. Start PostgreSQL with `docker compose up -d postgres`, apply local migrations with `npm run db:migrate`, and use `npx prisma migrate deploy` in production.
