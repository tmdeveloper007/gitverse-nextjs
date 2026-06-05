import { formatDate } from '../helpers';

describe('formatDate', () => {
  it('should format date correctly', () => {
    const date = new Date('2024-01-15');
    const result = formatDate(date);
    expect(result).toMatch(/Jan/i);
    expect(result).toMatch(/15/);
    expect(result).toMatch(/2024/);
  });

  it('should handle different months', () => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    months.forEach((month, index) => {
      const date = new Date(2024, index, 1);
      const result = formatDate(date);
      expect(result).toContain(month);
    });
  });

  it('should format year correctly', () => {
    const date = new Date('2025-06-20');
    const result = formatDate(date);
    expect(result).toContain('2025');
  });
});