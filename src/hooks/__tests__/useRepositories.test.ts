import { renderHook, waitFor } from '@testing-library/react';
import { useRepositories } from '../useRepositories';
import axios from 'axios';

jest.mock('axios');
jest.mock('@/services/apiConfig', () => ({
  buildApiUrl: (path: string) => `http://localhost:3000${path}`,
}));

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('useRepositories', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.setItem('gitverse_token', 'test-token');
  });

  afterEach(() => {
    localStorage.removeItem('gitverse_token');
  });

  it('should initialize with default values', () => {
    mockedAxios.get.mockResolvedValueOnce({ data: { data: [], nextCursor: null, hasMore: false } });
    const { result } = renderHook(() => useRepositories());
    expect(result.current.repos).toEqual([]);
    expect(result.current.hasMore).toBe(true);
    expect(result.current.error).toBeNull();
  });

  it('should fetch repositories on mount', async () => {
    const mockRepos = [
      { id: '1', name: 'repo1', url: 'https://github.com/test/repo1' },
      { id: '2', name: 'repo2', url: 'https://github.com/test/repo2' },
    ];

    mockedAxios.get.mockResolvedValueOnce({
      data: { data: mockRepos, nextCursor: 10, hasMore: true },
    });

    const { result } = renderHook(() => useRepositories());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.repos).toHaveLength(2);
    expect(result.current.hasMore).toBe(true);
  });

  it('should handle error when fetch fails', async () => {
    mockedAxios.get.mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => useRepositories());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBe('Network error');
  });

  it('should deduplicate repositories when loading more', async () => {
    const existingRepos = [{ id: '1', name: 'repo1', url: 'https://github.com/test/repo1' }];
    const newRepos = [{ id: '1', name: 'repo1', url: 'https://github.com/test/repo1' }, { id: '2', name: 'repo2', url: 'https://github.com/test/repo2' }];

    mockedAxios.get.mockResolvedValueOnce({
      data: { data: existingRepos, nextCursor: null, hasMore: false },
    });

    const { result } = renderHook(() => useRepositories());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    mockedAxios.get.mockResolvedValueOnce({
      data: { data: newRepos, nextCursor: null, hasMore: false },
    });

    await result.current.loadMore();

    await waitFor(() => {
      expect(result.current.repos).toHaveLength(2);
    });
  });
});