// Prepend the `"use client";` directive to the bundled output so the package
// is a valid React client module in Next.js App Router. esbuild strips
// module-level directives while bundling, so we re-add it here.
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const targets = ['dist/index.js', 'dist/index.cjs'];
const DIRECTIVE = '"use client";';

for (const rel of targets) {
  const file = join(root, rel);
  try {
    const content = await readFile(file, 'utf8');
    if (content.startsWith('"use client"') || content.startsWith("'use client'")) {
      continue;
    }
    await writeFile(file, `${DIRECTIVE}\n${content}`, 'utf8');
    console.log(`[banner] added "use client" to ${rel}`);
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }
}
