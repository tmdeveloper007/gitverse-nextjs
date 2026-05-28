import { renderHook, act, waitFor } from '@testing-library/react';
import { useRecentRepos, RecentRepository } from '../useRecentRepos';

const mockLocalStorage = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();

Object.defineProperty(window, 'localStorage', { value: mockLocalStorage });

describe('useRecentRepos', () => {
  beforeEach(() => {
    mockLocalStorage.clear();
  });

  it('should initialize with empty repos', async () => {
    const { result } = renderHook(() => useRecentRepos());
    expect(result.current.repos).toEqual([]);
    await waitFor(() => {
      expect(result.current.isLoaded).toBe(true);
    });
  });

  it('should load repos from localStorage after mount', async () => {
    const existingRepos: RecentRepository[] = [
      { owner: 'test-owner', name: 'test-repo', url: 'https://github.com/test-owner/test-repo', analyzedAt: Date.now() }
    ];
    mockLocalStorage.setItem('gitverse_recent_repositories', JSON.stringify(existingRepos));

    const { result } = renderHook(() => useRecentRepos());
    await waitFor(() => {
      expect(result.current.isLoaded).toBe(true);
    });
  });

  it('should add a repository', () => {
    const { result } = renderHook(() => useRecentRepos());

    act(() => {
      result.current.addRepo({ owner: 'test-owner', name: 'test-repo', url: 'https://github.com/test-owner/test-repo' });
    });

    expect(result.current.repos).toHaveLength(1);
    expect(result.current.repos[0].owner).toBe('test-owner');
    expect(result.current.repos[0].name).toBe('test-repo');
  });

  it('should not add duplicate repositories', () => {
    const { result } = renderHook(() => useRecentRepos());

    act(() => {
      result.current.addRepo({ owner: 'test-owner', name: 'test-repo', url: 'https://github.com/test-owner/test-repo' });
    });

    act(() => {
      result.current.addRepo({ owner: 'test-owner', name: 'test-repo', url: 'https://github.com/test-owner/test-repo' });
    });

    expect(result.current.repos).toHaveLength(1);
  });

  it('should limit repos to 5 items', () => {
    const { result } = renderHook(() => useRecentRepos());

    for (let i = 0; i < 7; i++) {
      act(() => {
        result.current.addRepo({ owner: `owner${i}`, name: `repo${i}`, url: `https://github.com/owner${i}/repo${i}` });
      });
    }

    expect(result.current.repos).toHaveLength(5);
  });

  it('should clear all repositories', () => {
    const { result } = renderHook(() => useRecentRepos());

    act(() => {
      result.current.addRepo({ owner: 'test-owner', name: 'test-repo', url: 'https://github.com/test-owner/test-repo' });
    });

    expect(result.current.repos).toHaveLength(1);

    act(() => {
      result.current.clearRepos();
    });

    expect(result.current.repos).toHaveLength(0);
  });

  it('should get repos via callback', () => {
    const { result } = renderHook(() => useRecentRepos());

    act(() => {
      result.current.addRepo({ owner: 'test-owner', name: 'test-repo', url: 'https://github.com/test-owner/test-repo' });
    });

    const repos = result.current.getRepos();
    expect(repos).toHaveLength(1);
  });
});