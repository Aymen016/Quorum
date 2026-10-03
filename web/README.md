# Fathom (local clone)

A Fathom-style AI notetaker for long, multi-speaker calls: a call library, speaker timeline, summaries with chapters, decisions and action items, a catch-up for each person, transcript search, clips, and an "Ask Fathom" panel that answers questions about one call or all of them. Claude Opus 5.5 does the AI work. This is a personal learning project; it does not use Fathom's logo and should not be published under the Fathom name.

## Run locally

```bash
cd web
npm install
cp .env.example .env   # then add GROQ_API_KEY (free) or ANTHROPIC_API_KEY
npm run dev
```

- App: http://localhost:5173
- API: http://localhost:8787 (Vite forwards `/api` requests to it)

**AI providers.** Groq (free tier, `openai/gpt-oss-120b`) or Anthropic (Claude Opus 5.5). If both keys are set, Anthropic is used unless `AI_PROVIDER=groq`. Groq's free tier allows about 8K tokens per minute, so long calls are summarized in parts (a 45-minute call is one request; a 3-hour call takes a few minutes), and Ask Fathom answers from the summary plus the transcript lines that best match the question rather than the whole transcript. Without any key the app still runs; summaries and Ask Fathom are off.

## Layout

- `src/`: React app. `util.ts` holds the transcript parser, which reads Zoom, Meet, Teams, Otter and Fathom exports, plus `.vtt` and `.srt` captions.
- `server/`: Express API. `ai.ts` picks the provider; `claude.ts` and `groq.ts` make the calls. `store.ts` saves meetings to `data/quorum.json`.
- `npm run build && npm start` serves the built app and the API together on port 8787.
