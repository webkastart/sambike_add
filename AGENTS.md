<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Project map

Sambike Ads is a Slovak campaign landing-page and lead-capture app with an internal campaign/lead administration area.

- Stack: Next.js 16 App Router, React 19, Tailwind CSS 4, Prisma 7 and SQLite in local development.
- Campaign mutations and lead submission live in `app/actions.ts`; the public landing page is `app/kampan/[slug]/page.tsx`.
- Prisma schema and migrations live under `prisma/`; the generated client is committed under `generated/prisma/` and must be refreshed with `npm run db:generate` after schema edits.
- Uploaded campaign media is validated in `lib/campaign-media.ts`; local development stores files under `storage/campaign-images/`, while production can use Cloudflare R2 by setting `CAMPAIGN_MEDIA_STORAGE="r2"` and the `R2_*` environment variables. Media is served through `app/uploads/[filename]/route.ts` with image/video content types and byte ranges.
- Hero and offer images are fixed campaign fields. The remaining ordered mixed-media gallery is the `CampaignGalleryItem` relation; it accepts images and MP4 videos, and the landing page determines their responsive layout from list position.
- Verification commands: `npm run lint`, `npx tsc --noEmit`, and `npm run build`. Apply local migrations with `npm run db:migrate`.
