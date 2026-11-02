import { describe, it, expect } from 'vitest';
import { MAX_SIZE, MIN_SIZE, TEXT_SIZES, clampSize, parseSize, stepSize } from '../textSize';

describe('text size', () => {
  it('steps through the common sizes', () => {
    expect(stepSize(16, 1)).toBe(18);
    expect(stepSize(16, -1)).toBe(14);
    expect(stepSize(10, -1)).toBe(9);
  });
  it('steps sensibly from a size that is not on the list', () => {
    expect(stepSize(17, 1)).toBe(18);
    expect(stepSize(17, -1)).toBe(16);
    expect(stepSize(13.5, 1)).toBe(14);
  });
  it('keeps going past the ends of the list', () => {
    expect(stepSize(72, 1)).toBe(76);
    expect(stepSize(9, -1)).toBeLessThan(9);
  });
  it('never leaves the allowed range', () => {
    expect(clampSize(1)).toBe(MIN_SIZE);
    expect(clampSize(9999)).toBe(MAX_SIZE);
    expect(stepSize(MIN_SIZE, -1)).toBe(MIN_SIZE);
    expect(stepSize(MAX_SIZE, 1)).toBe(MAX_SIZE);
  });
  it('the list is in order with no duplicates', () => {
    expect([...TEXT_SIZES].sort((a, b) => a - b)).toEqual(TEXT_SIZES);
    expect(new Set(TEXT_SIZES).size).toBe(TEXT_SIZES.length);
  });
  it('reads typed sizes', () => {
    expect(parseSize('18')).toBe(18);
    expect(parseSize(' 18px ')).toBe(18);
    expect(parseSize('14.6')).toBe(15);
    expect(parseSize('abc')).toBeNull();
    expect(parseSize('2')).toBeNull();
    expect(parseSize('500')).toBeNull();
    expect(parseSize('')).toBeNull();
  });
});
