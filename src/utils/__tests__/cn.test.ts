import { cn } from '../cn';
import { clsx } from 'clsx';

jest.mock('clsx');

describe('cn', () => {
  it('should call clsx with the arguments', () => {
    (clsx as jest.Mock).mockReturnValue('result');
    const result = cn('class1', 'class2');
    expect(clsx).toHaveBeenCalledWith('class1', 'class2');
    expect(result).toBe('result');
  });

  it('should handle multiple arguments', () => {
    (clsx as jest.Mock).mockReturnValue('combined');
    const result = cn('a', 'b', 'c');
    expect(clsx).toHaveBeenCalledWith('a', 'b', 'c');
  });

  it('should handle undefined and null', () => {
    (clsx as jest.Mock).mockReturnValue('clean');
    const result = cn('class', undefined, null, 'another');
    expect(clsx).toHaveBeenCalledWith('class', undefined, null, 'another');
  });
});