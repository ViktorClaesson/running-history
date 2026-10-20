import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProcessClient } from '../../src/lib/data/processClient';
import type { SampleSet } from '../../src/lib/domain/sampleTypes';
import type { RawActivity } from '../../src/lib/domain/types';
import { handleRequest, type ProcessRequest, type ProcessResponse } from '../../src/lib/workers/protocol';
import { fakeProcess } from '../helpers/fakeSource';

// The worker's real job (FIT → samples) needs a real FIT file, which never goes into the
// repo; the protocol is what's tested here, so decoding is replaced by a stand-in.
vi.mock('../../src/lib/data/processing', () => ({
  processRaw: (raw: RawActivity) => {
    if (raw.bytes.byteLength < 8) throw new Error('not a FIT file');
    return { ...structuredClone(SAMPLES), activityId: raw.id };
  },
}));

let SAMPLES: SampleSet;
const raw = (id: string, size = 16): RawActivity => ({
  id,
  format: 'fit',
  bytes: new ArrayBuffer(size),
  fetchedAt: 'x',
});

describe('E27 worker protocol', () => {
  it('answers a request with its samples, matched by id, and hands over their buffers', async () => {
    SAMPLES = await fakeProcess(raw('x'));
    const { response, transfer } = handleRequest({
      kind: 'process',
      requestId: 3,
      raw: raw('a'),
      fileSportIndex: 0,
    });
    expect(response).toMatchObject({ kind: 'processed', requestId: 3, samples: { activityId: 'a' } });
    if (response.kind !== 'processed') throw new Error('expected samples');
    const s = response.samples;
    expect(transfer).toEqual([s.seg.buffer, s.dt.buffer, s.dist.buffer, s.grade.buffer, s.hr.buffer]);
  });

  it('answers an undecodable file with an error message rather than throwing', () => {
    const { response, transfer } = handleRequest({
      kind: 'process',
      requestId: 7,
      raw: raw('x', 4),
      fileSportIndex: 0,
    });
    expect(response).toEqual({ kind: 'error', requestId: 7, message: 'not a FIT file' });
    expect(transfer).toEqual([]);
  });
});

/** A stand-in for the browser's Worker: answers each message later, in the order given by `order`. */
class FakeWorker {
  static last: FakeWorker;
  listeners: ((e: { data: ProcessResponse }) => void)[] = [];
  inbox: ProcessRequest[] = [];
  constructor() {
    FakeWorker.last = this;
  }
  addEventListener(type: string, f: (e: { data: ProcessResponse }) => void) {
    if (type === 'message') this.listeners.push(f);
  }
  postMessage(req: ProcessRequest) {
    this.inbox.push(req);
  }
  /** Answers the k-th message received. */
  answer(k: number) {
    const { response } = handleRequest(this.inbox[k]!);
    for (const f of this.listeners) f({ data: response });
  }
  terminate() {}
}

describe('E27 process client', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('turns each postMessage into a Promise that settles with the matching answer', async () => {
    SAMPLES = await fakeProcess(raw('x'));
    vi.stubGlobal('Worker', FakeWorker);
    const client = new ProcessClient();
    const a = client.process(raw('a'), { fileSportIndex: 0 });
    const b = client.process(raw('b'), { fileSportIndex: 0 });
    const bad = client.process(raw('c', 4), { fileSportIndex: 0 });
    const w = FakeWorker.last;
    expect(w.inbox.map((r) => r.raw.id)).toEqual(['a', 'b', 'c']);
    expect(new Set(w.inbox.map((r) => r.requestId)).size).toBe(3); // every request has its own id
    w.answer(1); // out of order: b first
    w.answer(2);
    w.answer(0);
    expect((await b).activityId).toBe('b');
    expect((await a).activityId).toBe('a');
    await expect(bad).rejects.toThrow('not a FIT file');
  });
});
