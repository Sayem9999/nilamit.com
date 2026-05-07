import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Tests for src/lib/sentry-tags.ts.
 *
 * The helpers are thin wrappers around `Sentry.getCurrentScope()` and
 * `Sentry.withScope()`. Mock the Sentry module and assert the expected
 * scope.setTag calls happen — that's all the public contract is.
 */

const { setTagSpy, captureExceptionSpy } = vi.hoisted(() => ({
  setTagSpy: vi.fn(),
  captureExceptionSpy: vi.fn(),
}));

vi.mock('@sentry/nextjs', () => ({
  getCurrentScope: () => ({ setTag: setTagSpy }),
  withScope: (fn: (scope: { setTag: typeof setTagSpy }) => void) => {
    fn({ setTag: setTagSpy });
  },
  captureException: captureExceptionSpy,
}));

import { tagSentryArea, captureWithArea } from '@/lib/sentry-tags';

describe('sentry-tags', () => {
  beforeEach(() => {
    setTagSpy.mockClear();
    captureExceptionSpy.mockClear();
  });

  describe('tagSentryArea', () => {
    it('sets both area and severity on the current scope', () => {
      tagSentryArea('bid', 'critical');
      expect(setTagSpy).toHaveBeenCalledWith('area', 'bid');
      expect(setTagSpy).toHaveBeenCalledWith('severity', 'critical');
    });

    it("defaults severity to 'warning' when omitted", () => {
      tagSentryArea('escrow');
      expect(setTagSpy).toHaveBeenCalledWith('area', 'escrow');
      expect(setTagSpy).toHaveBeenCalledWith('severity', 'warning');
    });

    it('accepts every defined SentryArea value', () => {
      const areas = ['bid', 'escrow', 'auth', 'cron', 'upload', 'admin', 'chat', 'dispute', 'logistics', 'test'] as const;
      for (const area of areas) {
        setTagSpy.mockClear();
        tagSentryArea(area, 'info');
        expect(setTagSpy).toHaveBeenCalledWith('area', area);
      }
    });
  });

  describe('captureWithArea', () => {
    it('tags the scope and captures the exception inside the same scope', () => {
      const err = new Error('boom');
      captureWithArea(err, 'dispute', 'critical');

      expect(setTagSpy).toHaveBeenCalledWith('area', 'dispute');
      expect(setTagSpy).toHaveBeenCalledWith('severity', 'critical');
      expect(captureExceptionSpy).toHaveBeenCalledWith(err);
    });

    it("defaults severity to 'warning' when omitted", () => {
      captureWithArea(new Error('x'), 'auth');
      expect(setTagSpy).toHaveBeenCalledWith('severity', 'warning');
    });
  });
});
