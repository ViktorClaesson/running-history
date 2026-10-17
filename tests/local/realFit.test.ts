import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { decodeFit } from '../../src/lib/data/fit';
import { chunkRun, timerSeconds } from '../../src/lib/domain/chunking';

/**
 * Runs only when RH_FIT_DIR points at a folder of real FIT files (`file-<id>.bin`), e.g.
 *   RH_FIT_DIR=/tmp/rh-spike npx vitest run tests/local
 * Real files carry GPS tracks, so they never go into the repo.
 */
const dir = process.env.RH_FIT_DIR;

describe.runIf(dir)('real FIT files', () => {
  it('decode and chunk with every invariant holding', () => {
    const files = readdirSync(dir!).filter((f) => /^file-.*\.bin$/.test(f));
    // The activity list, for each run's file_sport_index (a multisport file holds several runs' worth).
    const list = JSON.parse(readFileSync(join(dir!, 'list.json'), 'utf8')) as {
      id: string;
      file_sport_index?: number;
    }[];
    const sportIndex = new Map(list.map((a) => [a.id, a.file_sport_index ?? 0]));
    const offenders: string[] = [];
    const rules: Record<string, number> = {};
    const gap: Record<string, number> = {};
    let worstTimer = 0;
    let worstDist = 0;
    let ms = 0;
    for (const f of files) {
      const bytes = readFileSync(join(dir!, f));
      const t0 = performance.now();
      const id = f.slice(5, -4);
      const run = decodeFit(
        bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
        sportIndex.get(id) ?? 0,
      );
      const set = chunkRun(f, run, { chunkDistanceM: 100, processingVersion: 1 });
      ms += performance.now() - t0;
      rules[set.lapRule] = (rules[set.lapRule] ?? 0) + 1;
      gap[set.gapMethod] = (gap[set.gapMethod] ?? 0) + 1;
      const sum = (a: Float32Array) => a.reduce((x, y) => x + y, 0);
      if (run.t.length > 1) {
        const streamDist = run.dist[run.dist.length - 1]! - run.dist[0]!;
        let streamDur = 0;
        for (let i = 1; i < run.t.length; i++)
          streamDur += timerSeconds(run.t[i - 1]!, run.t[i]!, run.pauses);
        expect(Math.abs(sum(set.distM) - streamDist)).toBeLessThan(0.05);
        expect(Math.abs(sum(set.durS) - streamDur)).toBeLessThan(0.05);
        if (Math.abs(streamDur - run.totals.timerS) > 3)
          offenders.push(`${id} ${(streamDur - run.totals.timerS).toFixed(1)}s`);
        worstTimer = Math.max(worstTimer, Math.abs(streamDur - run.totals.timerS));
        worstDist = Math.max(worstDist, Math.abs(streamDist - run.totals.distM));
      }
      for (let i = 1; i < set.seg.length; i++) expect(set.seg[i]).toBeGreaterThanOrEqual(set.seg[i - 1]!);
    }
    console.log(
      `${files.length} files, ${(ms / files.length).toFixed(1)} ms each; rules ${JSON.stringify(rules)}; ` +
        `gap ${JSON.stringify(gap)}; worst |stream − watch| timer ${worstTimer.toFixed(1)} s, distance ${worstDist.toFixed(1)} m; ` +
        `timer off by > 3 s: ${offenders.join(', ') || 'none'}`,
    );
  });
});
