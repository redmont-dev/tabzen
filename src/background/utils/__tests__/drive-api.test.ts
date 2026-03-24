import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DriveAPI } from '../drive-api';

describe('DriveAPI', () => {
  let api: DriveAPI;
  let mockFetch: ReturnType<typeof vi.fn>;
  const mockGetToken = vi.fn(async () => 'test-token');

  beforeEach(() => {
    mockGetToken.mockClear();
    mockFetch = vi.fn();
    globalThis.fetch = mockFetch;
  });

  function createApi() {
    return new DriveAPI(mockGetToken);
  }

  function mockResponse(body: unknown, ok = true, status = 200) {
    return {
      ok,
      status,
      json: async () => body,
      text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
    };
  }

  describe('listFiles', () => {
    it('sends GET request with correct params and returns files', async () => {
      api = createApi();
      const files = [{ id: 'f1', name: 'session.json', mimeType: 'application/json' }];
      mockFetch.mockResolvedValue(mockResponse({ files }));

      const result = await api.listFiles();

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain('https://www.googleapis.com/drive/v3/files');
      expect(url).toContain('spaces=appDataFolder');
      expect(opts.headers.Authorization).toBe('Bearer test-token');
      expect(result).toEqual(files);
    });

    it('throws on non-OK response', async () => {
      api = createApi();
      mockFetch.mockResolvedValue(mockResponse('Not found', false, 404));

      await expect(api.listFiles()).rejects.toThrow('Drive API listFiles failed (404)');
    });
  });

  describe('createFile', () => {
    it('sends multipart POST with metadata and content', async () => {
      api = createApi();
      const driveFile = { id: 'new-id', name: 'test.json', mimeType: 'application/json' };
      mockFetch.mockResolvedValue(mockResponse(driveFile));

      const result = await api.createFile('test.json', '{"data":true}');

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain('upload/drive/v3/files');
      expect(url).toContain('uploadType=multipart');
      expect(opts.method).toBe('POST');
      expect(opts.headers['Content-Type']).toContain('multipart/related');
      expect(opts.body).toContain('"name":"test.json"');
      expect(opts.body).toContain('"parents":["appDataFolder"]');
      expect(opts.body).toContain('{"data":true}');
      expect(result).toEqual(driveFile);
    });

    it('throws on non-OK response', async () => {
      api = createApi();
      mockFetch.mockResolvedValue(mockResponse('Quota exceeded', false, 403));

      await expect(api.createFile('test.json', '{}')).rejects.toThrow('Drive API createFile failed (403)');
    });
  });

  describe('readFile', () => {
    it('sends GET request with alt=media and returns text content', async () => {
      api = createApi();
      mockFetch.mockResolvedValue(mockResponse('{"session":"data"}'));

      const result = await api.readFile('file-123');

      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toBe('https://www.googleapis.com/drive/v3/files/file-123?alt=media');
      expect(opts.headers.Authorization).toBe('Bearer test-token');
      expect(result).toBe('{"session":"data"}');
    });

    it('throws on non-OK response', async () => {
      api = createApi();
      mockFetch.mockResolvedValue(mockResponse('Gone', false, 410));

      await expect(api.readFile('gone-id')).rejects.toThrow('Drive API readFile failed (410)');
    });
  });

  describe('updateFile', () => {
    it('sends PATCH request with media upload', async () => {
      api = createApi();
      const driveFile = { id: 'f1', name: 'test.json', mimeType: 'application/json' };
      mockFetch.mockResolvedValue(mockResponse(driveFile));

      const result = await api.updateFile('f1', '{"updated":true}');

      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain('upload/drive/v3/files/f1');
      expect(url).toContain('uploadType=media');
      expect(opts.method).toBe('PATCH');
      expect(opts.headers['Content-Type']).toBe('application/json');
      expect(opts.body).toBe('{"updated":true}');
      expect(result).toEqual(driveFile);
    });
  });

  describe('deleteFile', () => {
    it('sends DELETE request', async () => {
      api = createApi();
      // DELETE returns 204 No Content typically
      mockFetch.mockResolvedValue({ ok: true, status: 204, text: async () => '', json: async () => ({}) });

      await api.deleteFile('del-id');

      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toBe('https://www.googleapis.com/drive/v3/files/del-id');
      expect(opts.method).toBe('DELETE');
      expect(opts.headers.Authorization).toBe('Bearer test-token');
    });

    it('throws on non-OK response', async () => {
      api = createApi();
      mockFetch.mockResolvedValue(mockResponse('Forbidden', false, 403));

      await expect(api.deleteFile('bad-id')).rejects.toThrow('Drive API deleteFile failed (403)');
    });
  });

  describe('token provider', () => {
    it('calls getToken for each request', async () => {
      api = createApi();
      mockFetch.mockResolvedValue(mockResponse({ files: [] }));

      await api.listFiles();
      await api.listFiles();

      expect(mockGetToken).toHaveBeenCalledTimes(2);
    });
  });
});
