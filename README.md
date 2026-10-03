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

## Deploy (Render, free)

`render.yaml` defines the service. On render.com: New → Blueprint → pick this repo → paste `GROQ_API_KEY`. The free plan's disk is temporary, so added calls reset when the service restarts.
