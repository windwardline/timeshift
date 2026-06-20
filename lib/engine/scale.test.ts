import { describe, it, expect } from 'vitest';
import { fractionAt, intervalToRect, type Axis } from './scale';

// US-D1: every element on the timeline is placed by one shared time-to-x scale.
// A 60-minute axis makes the arithmetic obvious.
const axis: Axis = {
  start: new Date('2025-06-02T10:00:00Z'),
  end: new Date('2025-06-02T11:00:00Z'),
};

describe('fractionAt', () => {
  it('maps an instant to its fraction along the axis', () => {
    expect(fractionAt(axis.start, axis)).toBe(0);
    expect(fractionAt(new Date('2025-06-02T10:30:00Z'), axis)).toBe(0.5);
    expect(fractionAt(axis.end, axis)).toBe(1);
  });
});

describe('intervalToRect', () => {
  it('maps a UTC interval to a positioned rect on a pixel axis', () => {
    const rect = intervalToRect(
      new Date('2025-06-02T10:15:00Z'),
      new Date('2025-06-02T10:45:00Z'),
      axis,
      600,
    );
    expect(rect).toEqual({ x: 150, width: 300 });
  });
});
