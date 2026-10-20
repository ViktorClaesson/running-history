import { todo } from '../exercise';
import type { SampleSet } from '../domain/sampleTypes';
import type { RawActivity } from '../domain/types';

/**
 * The messages between the page and the processing worker. A worker shares no memory with
 * the page: everything crosses as a message, copied by the structured clone algorithm
 * (https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Structured_clone_algorithm).
 * Every request carries an id so its answer can be matched up, since several can be in
 * flight at once.
 */
export interface ProcessRequest {
  kind: 'process';
  requestId: number;
  raw: RawActivity;
  fileSportIndex: number;
}

export type ProcessResponse =
  | { kind: 'processed'; requestId: number; samples: SampleSet }
  | { kind: 'error'; requestId: number; message: string };

/*
 * TODO(E27) · worker messages (part 1 of 2: the worker's side) · difficulty ★★☆ · phase 4
 *   handleRequest(req)
 *     Answer one request: processRaw(req.raw, { fileSportIndex: req.fileSportIndex }) →
 *     { kind: 'processed', requestId, samples }, with transfer = sampleBuffers(samples).
 *     If processing throws, answer { kind: 'error', requestId, message } with nothing to
 *     transfer: never throw, or the page would wait for an answer that never comes.
 * Concepts:
 * - Web Workers: https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers
 * - transferable objects: https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Transferable_objects
 * Check: npm run exercise E27 (tests/data/worker.test.ts). Part 2 is process() in
 * data/processClient.ts.
 * Spoiler: none, the legacy app had no worker.
 */
/**
 * One request → one response, plus the buffers to *transfer* rather than copy: the sample
 * arrays move to the page without a copy (the worker can't use them afterwards).
 * https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Transferable_objects
 */
export function handleRequest(req: ProcessRequest): { response: ProcessResponse; transfer: ArrayBuffer[] } {
  return todo('E27', req);
}

/** The buffers under a sample set's columns, to transfer instead of copy. */
export function sampleBuffers(c: SampleSet): ArrayBuffer[] {
  const arrays = [c.seg, c.dt, c.dist, c.grade, c.hr];
  return arrays.map((a) => a.buffer).filter((b): b is ArrayBuffer => b instanceof ArrayBuffer);
}
