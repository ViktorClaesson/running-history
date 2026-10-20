import { describe, expect, it } from 'vitest';
import { EXERCISES, ExerciseNotDoneError, isNotDone, todo, whenDone } from '../src/lib/exercise';

describe('the exercise helper', () => {
  it('todo throws an ExerciseNotDoneError naming the exercise', () => {
    expect(() => todo('E04', 1, 2)).toThrow('Exercise E04 not done yet: window series');
    expect(() => todo('E04')).toThrow(ExerciseNotDoneError);
  });

  it('whenDone falls back only for an unfinished exercise, never for a real error', () => {
    expect(
      whenDone(
        () => 1,
        () => 2,
      ),
    ).toBe(1);
    expect(
      whenDone(
        () => todo('E01'),
        (e) => e.id,
      ),
    ).toBe('E01');
    expect(() =>
      whenDone(
        () => JSON.parse('{'),
        () => 0,
      ),
    ).toThrow(SyntaxError);
    expect(isNotDone(new Error('x'))).toBe(false);
  });

  it('numbers the 33 exercises in order, with no gaps', () => {
    const ids = Object.keys(EXERCISES);
    expect(ids).toEqual(Array.from({ length: 33 }, (_, k) => `E${String(k + 1).padStart(2, '0')}`));
  });
});
