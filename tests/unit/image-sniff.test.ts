import { describe, it, expect } from 'vitest';
import { detectImageMime } from '@/lib/image-sniff';

// /api/upload relies on this to reject spoofed uploads — a client can set any
// Content-Type, so the actual bytes are the only trustworthy signal. A bug here
// would let HTML/JS/SVG payloads through as "images".

/** Build a 16-byte buffer starting with the given signature bytes. */
const buf = (bytes: number[]): Uint8Array => {
  const a = new Uint8Array(16);
  a.set(bytes);
  return a;
};

describe('detectImageMime — accepts real image signatures', () => {
  it('JPEG (FF D8 FF)', () => {
    expect(detectImageMime(buf([0xff, 0xd8, 0xff, 0xe0]))).toBe('image/jpeg');
  });

  it('PNG (89 50 4E 47 0D 0A 1A 0A)', () => {
    expect(detectImageMime(buf([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe('image/png');
  });

  it('GIF87a and GIF89a', () => {
    expect(detectImageMime(buf([0x47, 0x49, 0x46, 0x38, 0x37, 0x61]))).toBe('image/gif');
    expect(detectImageMime(buf([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]))).toBe('image/gif');
  });

  it('WebP (RIFF....WEBP)', () => {
    // "RIFF" at 0-3, size bytes 4-7 (any), "WEBP" at 8-11
    expect(
      detectImageMime(buf([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50])),
    ).toBe('image/webp');
  });
});

describe('detectImageMime — rejects spoofed / non-image payloads', () => {
  it('rejects HTML', () => {
    const html = new TextEncoder().encode('<!DOCTYPE html><script>');
    expect(detectImageMime(html)).toBeNull();
  });

  it('rejects SVG (XML, not a raster image we accept)', () => {
    const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg">');
    expect(detectImageMime(svg)).toBeNull();
  });

  it('rejects all-zero / random bytes', () => {
    expect(detectImageMime(new Uint8Array(16))).toBeNull();
    expect(detectImageMime(buf([0x12, 0x34, 0x56, 0x78, 0x9a]))).toBeNull();
  });

  it('rejects buffers shorter than 12 bytes even with a valid prefix', () => {
    expect(detectImageMime(new Uint8Array([0xff, 0xd8, 0xff]))).toBeNull();
  });

  it('rejects RIFF container that is not WEBP (e.g. WAV/AVI)', () => {
    // "RIFF" + "WAVE" — must NOT be treated as an image.
    expect(
      detectImageMime(buf([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x41, 0x56, 0x45])),
    ).toBeNull();
  });
});
