import { describe, expect, it } from 'vitest';
import { pastThreshold, placeMenu, pullDistance, resolveDrag, rollColumns } from './gestures';

describe('resolveDrag', () => {
  it('commits a slow drag past 50% of the width', () => {
    expect(resolveDrag(-180, -50, 320)).toBe('commit');
  });
  it('cancels a slow drag short of 50%', () => {
    expect(resolveDrag(-100, -50, 320)).toBe('cancel');
  });
  it('commits a fast flick in the drag direction once it has moved a little', () => {
    expect(resolveDrag(-60, -900, 320)).toBe('commit');
  });
  it('ignores a flick that barely moved or went the other way', () => {
    expect(resolveDrag(-10, -900, 320)).toBe('cancel');
    expect(resolveDrag(-100, 900, 320)).toBe('cancel');
  });
  it('works for both directions', () => {
    expect(resolveDrag(200, 0, 320)).toBe('commit');
    expect(pastThreshold(161, 320)).toBe(true);
    expect(pastThreshold(-159, 320)).toBe(false);
  });
});

describe('placeMenu', () => {
  const vp = { w: 390, h: 844 };
  const size = { w: 200, h: 160 };
  it('opens down-right of the point when it fits', () => {
    expect(placeMenu({ x: 40, y: 100 }, size, vp, 8)).toEqual({ left: 40, top: 100, originX: 'left', originY: 'top' });
  });
  it('flips left and up near the bottom-right corner', () => {
    const p = placeMenu({ x: 380, y: 830 }, size, vp, 8);
    expect(p.originX).toBe('right');
    expect(p.originY).toBe('bottom');
    expect(p.left + size.w).toBeLessThanOrEqual(vp.w - 8);
    expect(p.top + size.h).toBeLessThanOrEqual(vp.h - 8);
  });
  it('never leaves the viewport margin', () => {
    const p = placeMenu({ x: -50, y: -50 }, size, vp, 8);
    expect(p.left).toBeGreaterThanOrEqual(8);
    expect(p.top).toBeGreaterThanOrEqual(8);
  });
});

describe('rollColumns', () => {
  it('marks digits and keeps separators static', () => {
    expect(rollColumns('1,520').map((c) => c.digit)).toEqual([1, null, 5, 2, 0]);
  });
  it('keys columns from the right so the ones column is stable as the number grows', () => {
    const a = rollColumns('999');
    const b = rollColumns('1,000');
    expect(a[2].key).toBe(b[4].key);
    expect(a[0].key).toBe(b[2].key);
  });
});

describe('pullDistance', () => {
  it('is zero for no pull and approaches but never reaches the max', () => {
    expect(pullDistance(0, 80)).toBe(0);
    expect(pullDistance(2000, 80)).toBeLessThan(80);
    expect(pullDistance(2000, 80)).toBeGreaterThan(79);
  });
  it('grows monotonically with resistance', () => {
    const a = pullDistance(40, 80);
    const b = pullDistance(80, 80);
    const c = pullDistance(160, 80);
    expect((b - a) / 40).toBeGreaterThan((c - b) / 80);
  });
});
