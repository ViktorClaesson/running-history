import { buildSamples } from '../domain/samples';
import type { SampleSet } from '../domain/sampleTypes';
import type { ActivitySummary, RawActivity } from '../domain/types';
import { decodeFit } from './fit';
import { PROCESSING_VERSION } from './processingVersion';

/** Raw → samples. Pure apart from decoding; runs inside the Web Worker. */
export function processRaw(raw: RawActivity, summary: Pick<ActivitySummary, 'fileSportIndex'>): SampleSet {
  return buildSamples(raw.id, decodeFit(raw.bytes, summary.fileSportIndex), PROCESSING_VERSION);
}
