// `npm run test` runs every test once; `npm run test -- E04` (or `npm run exercise E04`)
// runs only the tests of exercise E04. Vitest reads a bare word as a *file* filter, so
// exercise ids are turned into a test-name filter (-t) here; anything else is passed on.
import { spawnSync } from 'node:child_process';

const args = process.argv.slice(2);
const ids = args.filter((a) => /^E\d\d$/i.test(a)).map((a) => a.toUpperCase());
const rest = args.filter((a) => !/^E\d\d$/i.test(a));
const filter = ids.length ? ['-t', `\\b(${ids.join('|')})\\b`] : [];

const r = spawnSync('npx', ['vitest', 'run', ...filter, ...rest], { stdio: 'inherit' });
process.exit(r.status ?? 1);
