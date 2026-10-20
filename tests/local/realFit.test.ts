import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { decodeFit } from '../../src/lib/data/fit';
import { buildChunks } from '../../src/lib/domain/chunks';
import { buildSamples, timerSeconds } from '../../src/lib/domain/samples';

/**
 * Runs only when RH_FIT_DIR points at a folder of real FIT files (`file-<id>.bin`, plus the
 * activity list as `list.json` for multisport files), e.g.
 *   RH_FIT_DIR=/tmp/rh-spike npx vitest run tests/local
 * Real files carry GPS tracks, so they never go into the repo.
 */
const dir = process.env.RH_FIT_DIR;
const sum = (a: Float32Array) => a.reduce((x, y) => x + y, 0);

describe.runIf(dir)('E19 real FIT files', () => {
  it('decode into samples and chunks with every invariant holding', () => {
    const files = readdirSync(dir!).filter((f) => /^file-.*\.bin$/.test(f));
    const list = JSON.parse(readFileSync(join(dir!, 'list.json'), 'utf8')) as {
      id: string;
      file_sport_index?: number;
    }[];
    const sportIndex = new Map(list.map((a) => [a.id, a.file_sport_index ?? 0]));
    const rules: Record<string, number> = {};
    let samples = 0;
    let ms = 0;
    for (const f of files) {
      const bytes = readFileSync(join(dir!, f));
      const id = f.slice(5, -4);
      const t0 = performance.now();
      const run = decodeFit(
        bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
        sportIndex.get(id) ?? 0,
      );
      const s = buildSamples(id, run, 3);
      ms += performance.now() - t0;
      samples += s.dt.length;
      rules[s.lapRule] = (rules[s.lapRule] ?? 0) + 1;
      if (run.t.length > 1) {
        let streamDur = 0;
        for (let i = 1; i < run.t.length; i++)
          streamDur += timerSeconds(run.t[i - 1]!, run.t[i]!, run.pauses);
        expect(Math.abs(sum(s.dist) - (run.dist[run.dist.length - 1]! - run.dist[0]!))).toBeLessThan(0.05);
        expect(Math.abs(sum(s.dt) - streamDur)).toBeLessThan(0.05);
      }
      for (const sec of [0, 10, 60]) {
        const c = buildChunks(s, sec);
        expect(Math.abs(sum(c.distM) - sum(s.dist))).toBeLessThan(0.05);
        expect(Math.abs(sum(c.durS) - sum(s.dt))).toBeLessThan(0.05);
        for (let i = 1; i < c.seg.length; i++) expect(c.seg[i]).toBeGreaterThanOrEqual(c.seg[i - 1]!);
      }
    }
    console.log(
      `${files.length} files, ${samples} samples, ${(ms / files.length).toFixed(1)} ms each to decode; rules ${JSON.stringify(rules)}`,
    );
  });
});
