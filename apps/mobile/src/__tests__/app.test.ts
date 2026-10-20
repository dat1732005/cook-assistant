import { describe, it, expect } from 'vitest';
import { greet } from '@cook/core';

describe('Mobile App', () => {
  it('imports and uses @cook/core correctly', () => {
    const greeting = greet('bạn');
    expect(greeting).toBe('Chào bạn! Sẵn sàng nấu ăn.');
  });
});

