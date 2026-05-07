import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('server-only', () => ({}));

describe('Image Moderation (Fail-Open Architecture)', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('fails open (allows upload) when IMAGE_MODERATION is disabled or missing', async () => {
    process.env.IMAGE_MODERATION = 'disabled';
    
    // We must mock logger and sentry before dynamic import
    vi.doMock('@sentry/nextjs', () => ({
      captureMessage: vi.fn(),
      captureException: vi.fn(),
    }));
    vi.doMock('@/lib/logger', () => ({
      log: { warn: vi.fn(), error: vi.fn() }
    }));

    const { moderateImage } = await import('@/lib/image-moderation');
    
    const result = await moderateImage(Buffer.from('mock-image'));
    expect(result.allowed).toBe(true);
    expect(result.reason).toBe('unconfigured');
  });

  it('fails open and logs warning when credentials are missing', async () => {
    process.env.IMAGE_MODERATION = 'enabled';
    process.env.FIREBASE_PROJECT_ID = ''; // Missing project ID
    
    const captureMessage = vi.fn();
    vi.doMock('@sentry/nextjs', () => ({
      captureMessage,
      captureException: vi.fn(),
    }));
    
    const mockWarn = vi.fn();
    vi.doMock('@/lib/logger', () => ({
      log: { warn: mockWarn, error: vi.fn() }
    }));

    const { moderateImage } = await import('@/lib/image-moderation');
    const result = await moderateImage(Buffer.from('mock-image'));
    
    expect(result.allowed).toBe(true);
    expect(result.reason).toBe('client-unavailable');
    expect(mockWarn).toHaveBeenCalledWith(expect.stringContaining('Vision client unavailable'));
    expect(captureMessage).toHaveBeenCalledWith(expect.stringContaining('Vision client unavailable'), expect.any(Object));
  });

  it('fails open and logs to Sentry when Vision API throws an exception', async () => {
    process.env.IMAGE_MODERATION = 'enabled';
    process.env.FIREBASE_PROJECT_ID = 'test-project';
    process.env.FIREBASE_CLIENT_EMAIL = 'test@nilamit.test';
    process.env.FIREBASE_PRIVATE_KEY = 'test-key';

    const captureException = vi.fn();
    vi.doMock('@sentry/nextjs', () => ({
      captureMessage: vi.fn(),
      captureException,
    }));
    
    const mockError = vi.fn();
    vi.doMock('@/lib/logger', () => ({
      log: { warn: vi.fn(), error: mockError }
    }));

    const networkError = new Error('Connection timeout to Vision API');
    vi.doMock('@google-cloud/vision', () => ({
      ImageAnnotatorClient: class {
        safeSearchDetection = vi.fn().mockRejectedValue(networkError);
      }
    }));

    const { moderateImage } = await import('@/lib/image-moderation');
    const result = await moderateImage(Buffer.from('mock-image'));

    expect(result.allowed).toBe(true);
    expect(result.reason).toBe('api-error');
    expect(captureException).toHaveBeenCalledWith(networkError, expect.any(Object));
    expect(mockError).toHaveBeenCalledWith(expect.stringContaining('SafeSearch call failed'), networkError, expect.any(Object));
  });

  it('blocks when adult content is LIKELY', async () => {
    process.env.IMAGE_MODERATION = 'enabled';
    process.env.FIREBASE_PROJECT_ID = 'test-project';
    process.env.FIREBASE_CLIENT_EMAIL = 'test@nilamit.test';
    process.env.FIREBASE_PRIVATE_KEY = 'test-key';

    vi.doMock('@sentry/nextjs', () => ({
      captureMessage: vi.fn(),
      captureException: vi.fn(),
    }));
    vi.doMock('@/lib/logger', () => ({
      log: { warn: vi.fn(), error: vi.fn() }
    }));

    vi.doMock('@google-cloud/vision', () => ({
      ImageAnnotatorClient: class {
        safeSearchDetection = vi.fn().mockResolvedValue([{
          safeSearchAnnotation: { adult: 'LIKELY', violence: 'POSSIBLE', racy: 'UNKNOWN', medical: 'UNKNOWN', spoof: 'UNKNOWN' }
        }]);
      }
    }));

    const { moderateImage } = await import('@/lib/image-moderation');
    const result = await moderateImage(Buffer.from('mock-image'));

    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('adult');
    expect(result.scores?.adult).toBe('LIKELY');
  });
  
  it('allows upload when all content is POSSIBLE or below', async () => {
    process.env.IMAGE_MODERATION = 'enabled';
    process.env.FIREBASE_PROJECT_ID = 'test-project';
    process.env.FIREBASE_CLIENT_EMAIL = 'test@nilamit.test';
    process.env.FIREBASE_PRIVATE_KEY = 'test-key';

    vi.doMock('@sentry/nextjs', () => ({
      captureMessage: vi.fn(),
      captureException: vi.fn(),
    }));
    vi.doMock('@/lib/logger', () => ({
      log: { warn: vi.fn(), error: vi.fn() }
    }));

    vi.doMock('@google-cloud/vision', () => ({
      ImageAnnotatorClient: class {
        safeSearchDetection = vi.fn().mockResolvedValue([{
          safeSearchAnnotation: { adult: 'POSSIBLE', violence: 'UNLIKELY', racy: 'POSSIBLE', medical: 'VERY_UNLIKELY', spoof: 'UNKNOWN' }
        }]);
      }
    }));

    const { moderateImage } = await import('@/lib/image-moderation');
    const result = await moderateImage(Buffer.from('mock-image'));

    expect(result.allowed).toBe(true);
    expect(result.reason).toBeUndefined();
    expect(result.scores?.adult).toBe('POSSIBLE');
  });
});
