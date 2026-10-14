import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { buildApiUrl, getApiBaseUrl } from '../api.js';

describe('API URL Resolution (buildApiUrl & getApiBaseUrl)', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('When no base URL is configured (Relative same-origin default)', () => {
    beforeEach(() => {
      vi.stubEnv('VITE_API_URL', '');
      vi.stubEnv('VITE_BACKEND_URL', '');
    });

    it('resolves empty base URL to empty string', () => {
      expect(getApiBaseUrl()).toBe('');
    });

    it('resolves clean path to /api/path', () => {
      expect(buildApiUrl('/projects')).toBe('/api/projects');
      expect(buildApiUrl('projects')).toBe('/api/projects');
    });

    it('does not duplicate /api if path already starts with /api', () => {
      expect(buildApiUrl('/api/health')).toBe('/api/health');
      expect(buildApiUrl('/api/health/ready')).toBe('/api/health/ready');
      expect(buildApiUrl('/api')).toBe('/api');
    });

    it('preserves query parameters and fragments', () => {
      expect(buildApiUrl('/projects?status=active&limit=10')).toBe('/api/projects?status=active&limit=10');
      expect(buildApiUrl('tasks?priority=high#section1')).toBe('/api/tasks?priority=high#section1');
    });

    it('returns absolute external URLs unchanged', () => {
      expect(buildApiUrl('https://cdn.example.com/audio.wav')).toBe('https://cdn.example.com/audio.wav');
      expect(buildApiUrl('http://storage.googleapis.com/file.pdf')).toBe('http://storage.googleapis.com/file.pdf');
    });
  });

  describe('When base URL is origin-only (without /api suffix)', () => {
    beforeEach(() => {
      vi.stubEnv('VITE_API_URL', 'https://backend.vani.ai');
    });

    it('resolves base URL correctly and trims trailing slashes', () => {
      expect(getApiBaseUrl()).toBe('https://backend.vani.ai');
    });

    it('appends /api prefix to paths lacking it', () => {
      expect(buildApiUrl('/projects')).toBe('https://backend.vani.ai/api/projects');
      expect(buildApiUrl('auth/me')).toBe('https://backend.vani.ai/api/auth/me');
    });

    it('does not duplicate /api when path already has /api', () => {
      expect(buildApiUrl('/api/health')).toBe('https://backend.vani.ai/api/health');
      expect(buildApiUrl('/api')).toBe('https://backend.vani.ai/api');
    });
  });

  describe('When base URL already includes /api suffix (Regression Protection)', () => {
    beforeEach(() => {
      vi.stubEnv('VITE_API_URL', 'https://backend.vani.ai/api');
    });

    it('does not create duplicate /api/api/projects', () => {
      expect(buildApiUrl('/projects')).toBe('https://backend.vani.ai/api/projects');
      expect(buildApiUrl('projects')).toBe('https://backend.vani.ai/api/projects');
    });

    it('does not duplicate /api when path also has /api/', () => {
      expect(buildApiUrl('/api/health/ready')).toBe('https://backend.vani.ai/api/health/ready');
      expect(buildApiUrl('/api/projects')).toBe('https://backend.vani.ai/api/projects');
      expect(buildApiUrl('/api')).toBe('https://backend.vani.ai/api');
    });

    it('handles trailing slash on base URL ending with /api/', () => {
      vi.stubEnv('VITE_API_URL', 'https://backend.vani.ai/api/');
      expect(buildApiUrl('/projects')).toBe('https://backend.vani.ai/api/projects');
      expect(buildApiUrl('/api/health')).toBe('https://backend.vani.ai/api/health');
    });
  });
});
