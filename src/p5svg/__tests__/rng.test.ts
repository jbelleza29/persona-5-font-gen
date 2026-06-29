import { describe, it, expect } from 'vitest';
import { mulberry32, randomOp } from '../rng';

describe('mulberry32', () => {
  it('is deterministic for a given seed', () => {
    const a = mulberry32(12345);
    const b = mulberry32(12345);
    const seqA = Array.from({ length: 10 }, () => a());
    const seqB = Array.from({ length: 10 }, () => b());
    expect(seqA).toEqual(seqB);
  });

  it('produces values in [0, 1)', () => {
    const r = mulberry32(7);
    for (let i = 0; i < 1000; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('different seeds diverge', () => {
    const a = mulberry32(1)();
    const b = mulberry32(2)();
    expect(a).not.toEqual(b);
  });
});

describe('randomOp', () => {
  it('only returns +1 or -1', () => {
    const r = mulberry32(99);
    for (let i = 0; i < 100; i++) {
      expect([1, -1]).toContain(randomOp(r));
    }
  });
});
