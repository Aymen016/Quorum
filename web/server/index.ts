import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import express from 'express';
import app from './app.ts';
import { aiEnabled, NO_KEY, providerLabel } from './ai.ts';

// In production (npm run build && npm start) the API also serves the built React app.
const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/^(?!\/api).*/, (_req, res) => res.sendFile(path.join(dist, 'index.html')));
}

const PORT = Number(process.env.PORT) || 8787;
app.listen(PORT, () => {
  console.log(`Fathom API on http://localhost:${PORT}  (${aiEnabled() ? 'AI: ' + providerLabel() : 'AI off: ' + NO_KEY})`);
});
