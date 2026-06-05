import { extractRepoInfo } from '../helpers';

describe('extractRepoInfo', () => {
  it('should extract GitHub repo info', () => {
    const result = extractRepoInfo('https://github.com/owner/repo');
    expect(result).toEqual({ platform: 'github', owner: 'owner', repo: 'repo' });
  });

  it('should extract GitHub repo info with www', () => {
    const result = extractRepoInfo('https://www.github.com/owner/repo');
    expect(result).toEqual({ platform: 'github', owner: 'owner', repo: 'repo' });
  });

  it('should extract GitLab repo info', () => {
    const result = extractRepoInfo('https://gitlab.com/owner/repo');
    expect(result).toEqual({ platform: 'gitlab', owner: 'owner', repo: 'repo' });
  });

  it('should extract Bitbucket repo info', () => {
    const result = extractRepoInfo('https://bitbucket.org/owner/repo');
    expect(result).toEqual({ platform: 'bitbucket', owner: 'owner', repo: 'repo' });
  });

  it('should handle repos with dashes in name', () => {
    const result = extractRepoInfo('https://github.com/my-owner/my-repo-name');
    expect(result).toEqual({ platform: 'github', owner: 'my-owner', repo: 'my-repo-name' });
  });

  it('should handle repos with dots in name', () => {
    const result = extractRepoInfo('https://github.com/owner/repo.name');
    expect(result).toEqual({ platform: 'github', owner: 'owner', repo: 'repo.name' });
  });

  it('should return null for invalid URLs', () => {
    expect(extractRepoInfo('https://invalid.com/owner/repo')).toBeNull();
    expect(extractRepoInfo('not-a-url')).toBeNull();
    expect(extractRepoInfo('')).toBeNull();
  });
});