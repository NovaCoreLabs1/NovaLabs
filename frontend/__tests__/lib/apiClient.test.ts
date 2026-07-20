import { describe, it, expect, vi, beforeEach } from 'vitest';

const ACTUAL_BASE_URL = 'http://localhost:6001/api';

describe('ApiClient', () => {
  let apiClient: any;

  beforeEach(async () => {
    vi.restoreAllMocks();
    vi.stubGlobal('fetch', vi.fn());

    // Clear cookies
    document.cookie = 'csrf=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT';
    vi.stubEnv('NEXT_PUBLIC_API_URL', ACTUAL_BASE_URL);

    const mod = await import('@/lib/apiClient');
    apiClient = mod.apiClient;
  });

  describe('GET', () => {
    it('makes a GET request and returns JSON', async () => {
      const mockData = { id: '1', name: 'Workspace' };
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockData),
      } as Response);

      const result = await apiClient.get('/workspaces');
      expect(result).toEqual(mockData);
      expect(fetch).toHaveBeenCalledWith(
        `${ACTUAL_BASE_URL}/workspaces`,
        expect.objectContaining({ method: 'GET' }),
      );
    });

    it('throws on non-ok response with server error message', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ message: 'Not found' }),
      } as Response);

      await expect(apiClient.get('/workspaces/999')).rejects.toThrow('Not found');
    });

    it('throws a generic error when no server message is provided', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({}),
      } as Response);

      await expect(apiClient.get('/bad')).rejects.toThrow('An API error occurred');
    });

    it('throws on network error', async () => {
      vi.mocked(fetch).mockRejectedValueOnce(new Error('Failed to fetch'));

      await expect(apiClient.get('/fail')).rejects.toThrow('Failed to fetch');
    });
  });

  describe('POST', () => {
    it('sends a POST request with JSON body', async () => {
      const mockResponse = { id: '2' };
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as Response);

      const result = await apiClient.post('/workspaces', { name: 'New Space' });
      expect(result).toEqual(mockResponse);
      expect(fetch).toHaveBeenCalledWith(
        `${ACTUAL_BASE_URL}/workspaces`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ name: 'New Space' }),
        }),
      );
    });

    it('sends POST without body when data is undefined', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      } as Response);

      await apiClient.post('/login');
      const callArgs = vi.mocked(fetch).mock.calls[0][1] as RequestInit;
      expect(callArgs.body).toBeUndefined();
    });
  });

  describe('PATCH', () => {
    it('sends a PATCH request with JSON body', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      } as Response);

      await apiClient.patch('/workspaces/1', { name: 'Updated' });
      expect(fetch).toHaveBeenCalledWith(
        `${ACTUAL_BASE_URL}/workspaces/1`,
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ name: 'Updated' }),
        }),
      );
    });
  });

  describe('DELETE', () => {
    it('sends a DELETE request', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      } as Response);

      await apiClient.delete('/workspaces/1');
      expect(fetch).toHaveBeenCalledWith(
        `${ACTUAL_BASE_URL}/workspaces/1`,
        expect.objectContaining({ method: 'DELETE' }),
      );
    });
  });

  describe('token handling', () => {
    it('includes Bearer token when set', async () => {
      apiClient.setToken('my-access-token');
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      } as Response);

      await apiClient.get('/me');
      const callArgs = vi.mocked(fetch).mock.calls[0][1] as RequestInit;
      const headers = callArgs.headers as Record<string, string>;
      expect(headers['Authorization']).toBe('Bearer my-access-token');
      expect(headers['Content-Type']).toBe('application/json');
    });
  });
});
