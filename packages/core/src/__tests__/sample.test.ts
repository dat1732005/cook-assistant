import { describe, it, expect } from 'vitest';
import { greet } from '../index.js';

describe('greet', () => {
  it('should return a greeting in Vietnamese', () => {
    const result = greet('Bạn');
    expect(result).toBe('Chào Bạn! Sẵn sàng nấu ăn.');
  });

  it('should include the provided name', () => {
    const result = greet('Minh');
    expect(result).toContain('Minh');
  });
});
