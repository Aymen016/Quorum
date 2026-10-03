// Entry for Vercel. `npm run build:vercel` bundles this into api/index.mjs (committed), which
// Vercel runs as a serverless function; vercel.json routes /api/* to it.
import { waitUntil } from '@vercel/functions';
import app, { setKeepAlive } from './app.ts';

// Let background summaries finish after the response is sent (up to the function's maxDuration).
setKeepAlive(work => waitUntil(work));

export default app;
