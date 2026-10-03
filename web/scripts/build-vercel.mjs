// Bundles the Express API into one ESM file for Vercel (api/index.mjs). Run after changing server code.
import { build } from 'esbuild';

await build({
  entryPoints: ['server/vercel.ts'],
  outfile: 'api/index.mjs',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  // Express and friends are CommonJS; give the ESM bundle a require().
  banner: { js: "import { createRequire as __cr } from 'module'; const require = __cr(import.meta.url);" },
  logLevel: 'info',
});
