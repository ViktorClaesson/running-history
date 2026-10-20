import type { SampleSet } from '../domain/sampleTypes';
import type { RawActivity } from '../domain/types';
import { processRaw } from '../data/processing';

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

/**
 * One request → one response, plus the buffers to *transfer* rather than copy: the sample
 * arrays move to the page without a copy (the worker can't use them afterwards).
 * https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Transferable_objects
 */
export function handleRequest(req: ProcessRequest): { response: ProcessResponse; transfer: ArrayBuffer[] } {
  try {
    const samples = processRaw(req.raw, { fileSportIndex: req.fileSportIndex });
    return {
      response: { kind: 'processed', requestId: req.requestId, samples },
      transfer: sampleBuffers(samples),
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { response: { kind: 'error', requestId: req.requestId, message }, transfer: [] };
  }
}

/** The buffers under a sample set's columns, to transfer instead of copy. */
export function sampleBuffers(c: SampleSet): ArrayBuffer[] {
  const arrays = [c.seg, c.dt, c.dist, c.grade, c.hr];
  return arrays.map((a) => a.buffer).filter((b): b is ArrayBuffer => b instanceof ArrayBuffer);
}
