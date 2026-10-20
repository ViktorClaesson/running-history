// `npm run exercises`: the exercises still open, i.e. every `todo('Exx')` left in src/,
// with its title, difficulty and where it is. Titles come from src/lib/exercise.ts.
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const registry = readFileSync(join(root, 'src/lib/exercise.ts'), 'utf8');
const info = new Map(
  [...registry.matchAll(/(E\d\d): \{ title: '([^']+)', difficulty: (\d), phase: (\d) \}/g)].map((m) => [
    m[1],
    { title: m[2], difficulty: Number(m[3]), phase: Number(m[4]) },
  ]),
);

function* files(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) yield* files(p);
    else if (/\.(ts|svelte)$/.test(e.name) && !p.endsWith('exercise.ts')) yield p;
  }
}

const open = new Map();
for (const f of files(join(root, 'src'))) {
  for (const m of readFileSync(f, 'utf8').matchAll(/\btodo\('(E\d\d)'/g)) {
    const where = open.get(m[1]) ?? new Set();
    where.add(relative(root, f));
    open.set(m[1], where);
  }
}

if (!open.size) {
  console.log('No open exercises: every todo() is done.');
} else {
  const stars = (n) => '★'.repeat(n) + '☆'.repeat(3 - n);
  let phase = 0;
  for (const id of [...open.keys()].sort()) {
    const e = info.get(id) ?? { title: '?', difficulty: 0, phase: 0 };
    if (e.phase !== phase) console.log(`\nPhase ${(phase = e.phase)}`);
    console.log(`  ${id}  ${stars(e.difficulty)}  ${e.title.padEnd(26)} ${[...open.get(id)].join(', ')}`);
  }
  console.log(`\n${open.size} open of ${info.size}. Run one exercise's tests with: npm run exercise E01`);
}
