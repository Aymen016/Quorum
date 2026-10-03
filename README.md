# Quorum
AI meeting notetaker rebuilt from Fathom, designed for long multi-speaker meetings. Chapters, speaker timelines, per-person catch-up, cross-meeting search and shareable clips.

## What's here

- `web/`: the full app (React + Vite front end, Express API). Calls library, speaker timeline, AI summaries with chapters, decisions and action items, per-person catch-up, transcript search and clips, Ask (one call or all calls), Team Calls analytics, Playlists, Alerts and Deals. AI runs on Groq (free tier) or Claude. See [web/README.md](web/README.md).
- `app/`: the first single-file prototype.
- `recon/`: screenshots of the original product used as reference.

## Run locally

```bash
cd web
npm install
cp .env.example .env   # add GROQ_API_KEY (free at console.groq.com) or ANTHROPIC_API_KEY
npm run dev            # http://localhost:5173
```

## Deploy (free, no card): Vercel

On vercel.com: Add New → Project → import this repo → set **Root Directory** to `web` → add the `GROQ_API_KEY` environment variable → Deploy. `web/vercel.json` serves the React build and routes `/api/*` to `web/api/index.mjs`, a bundle of the Express API (rebuild it with `npm run build:vercel` after changing server code).

Serverless storage is temporary (`/tmp`), so calls you add can reset between visits; the example call is always there. Other configs: `render.yaml` (Render) and `deploy/huggingface/Dockerfile`.
