// Solmar Bay — the gta6-01 entry program (Node 22, standard library only).
// It hands the game in: copies the static game/ folder and the screenshots/
// beside this file into /output (or MAKEFUN_OUTPUT_DIR when run outside the
// grader) and writes /output/dossier.json, the summary the judge reads, with
// the vendored make.fun library. Run it with:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// Play the game locally with `node serve.ts` (http://localhost:8080).

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repo = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(outDir, { recursive: true });
mkdirSync(join(outDir, 'screenshots'), { recursive: true });
cpSync(join(repo, 'game'), join(outDir, 'game'), { recursive: true });
if (existsSync(join(repo, 'screenshots'))) {
  cpSync(join(repo, 'screenshots'), join(outDir, 'screenshots'), { recursive: true });
}

// The gate's caps, as the kit's reference states them: the dossier text is
// capped at 160 KiB; screenshots at 4 files of 256 KiB; game/ at 993 files
// and 48 MiB with no path over 1000 bytes.
writeFileSync(
  join(outDir, 'dossier.json'),
  buildDossier(outDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
