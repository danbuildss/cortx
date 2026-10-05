// Builds Cori into one file: agent/cori/dist/cori.mjs (npm run build:cori).
// Stamps the git commit into the bundle as the Cori version, so every run and
// observation records which code produced it.
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

export function coriVersion() {
  try {
    return execSync('git rev-parse --short=12 HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() || 'unknown';
  } catch {
    return 'unknown';
  }
}

export function buildOptions(version = coriVersion()) {
  return {
    entryPoints: [fileURLToPath(new URL('./index.ts', import.meta.url))],
    bundle: true,
    platform: 'node',
    target: 'node22',
    format: 'esm',
    outfile: fileURLToPath(new URL('./dist/cori.mjs', import.meta.url)),
    banner: { js: "import{createRequire}from'module';const require=createRequire(import.meta.url);" },
    define: { __CORI_VERSION__: JSON.stringify(version) },
    logLevel: 'warning',
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const version = coriVersion();
  await build(buildOptions(version));
  console.log(`built agent/cori/dist/cori.mjs (cori_version ${version})`);
}
