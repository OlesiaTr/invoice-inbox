import { InvalidTransitionError, assertTransition, canTransition } from './invoice-status';

describe('invoice status state machine', () => {
  it.each([
    ['uploaded', 'processing'],
    ['processing', 'completed'],
    ['processing', 'failed'],
    ['processing', 'uploaded'], // automatic retry scheduled
    ['failed', 'uploaded'], // manual retry
  ] as const)('allows %s → %s', (from, to) => {
    expect(canTransition(from, to)).toBe(true);
  });

  it.each([
    ['uploaded', 'completed'],
    ['uploaded', 'failed'],
    ['completed', 'uploaded'],
    ['completed', 'processing'],
    ['failed', 'processing'],
    ['failed', 'completed'],
  ] as const)('rejects %s → %s', (from, to) => {
    expect(canTransition(from, to)).toBe(false);
    expect(() => assertTransition(from, to)).toThrow(InvalidTransitionError);
  });
});
