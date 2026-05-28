import { validateRepoUrl } from '../helpers';

describe('validateRepoUrl', () => {
  it('should validate GitHub URLs', () => {
    expect(validateRepoUrl('https://github.com/owner/repo')).toBe(true);
    expect(validateRepoUrl('https://www.github.com/owner/repo')).toBe(true);
    expect(validateRepoUrl('http://github.com/owner/repo')).toBe(true);
  });

  it('should validate GitLab URLs', () => {
    expect(validateRepoUrl('https://gitlab.com/owner/repo')).toBe(true);
    expect(validateRepoUrl('http://www.gitlab.com/owner/repo')).toBe(true);
  });

  it('should validate Bitbucket URLs', () => {
    expect(validateRepoUrl('https://bitbucket.org/owner/repo')).toBe(true);
    expect(validateRepoUrl('http://bitbucket.org/owner/repo')).toBe(true);
  });

  it('should reject invalid URLs', () => {
    expect(validateRepoUrl('https://invalid.com/owner/repo')).toBe(false);
    expect(validateRepoUrl('not-a-url')).toBe(false);
    expect(validateRepoUrl('')).toBe(false);
    expect(validateRepoUrl('https://github.com')).toBe(false);
  });

  it('should handle repos with special characters', () => {
    expect(validateRepoUrl('https://github.com/owner/repo-name')).toBe(true);
    expect(validateRepoUrl('https://github.com/owner/repo.name')).toBe(true);
    expect(validateRepoUrl('https://github.com/owner/repo_name')).toBe(true);
  });
});