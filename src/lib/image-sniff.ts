/**
 * Tiny zero-dependency magic-byte sniffer for the four image formats we accept.
 *
 * Why: `file.type` (and the `Content-Type` of a multipart part) is set by the
 * client and trivially spoofable. An attacker can upload an HTML/JS/SVG/binary
 * payload with a fake `image/png` Content-Type and bypass MIME-only checks. By
 * inspecting the actual bytes we make sure the file really is what it claims.
 *
 * Signatures used:
 *   JPEG : FF D8 FF
 *   PNG  : 89 50 4E 47 0D 0A 1A 0A
 *   GIF  : 47 49 46 38 (37|39) 61   ("GIF87a" or "GIF89a")
 *   WebP : "RIFF" .... "WEBP"        (bytes 0-3 "RIFF", 8-11 "WEBP")
 */

export type SupportedImageMime =
  | 'image/jpeg'
  | 'image/png'
  | 'image/gif'
  | 'image/webp';

export const SUPPORTED_IMAGE_MIMES: readonly SupportedImageMime[] = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
];

const startsWith = (buf: Uint8Array, sig: number[]): boolean => {
  if (buf.length < sig.length) return false;
  for (let i = 0; i < sig.length; i++) {
    if (buf[i] !== sig[i]) return false;
  }
  return true;
};

const bytesAt = (buf: Uint8Array, offset: number, sig: number[]): boolean => {
  if (buf.length < offset + sig.length) return false;
  for (let i = 0; i < sig.length; i++) {
    if (buf[offset + i] !== sig[i]) return false;
  }
  return true;
};

/**
 * Detects the actual MIME type from the leading bytes of a file. Returns null
 * when the bytes don't match any supported image format.
 *
 * Pass at least the first 16 bytes — this never reads beyond what's needed.
 */
export function detectImageMime(buffer: Uint8Array): SupportedImageMime | null {
  if (buffer.length < 12) return null;

  // JPEG: FF D8 FF
  if (startsWith(buffer, [0xff, 0xd8, 0xff])) return 'image/jpeg';

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (startsWith(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return 'image/png';
  }

  // GIF: "GIF87a" or "GIF89a"
  if (
    startsWith(buffer, [0x47, 0x49, 0x46, 0x38, 0x37, 0x61]) ||
    startsWith(buffer, [0x47, 0x49, 0x46, 0x38, 0x39, 0x61])
  ) {
    return 'image/gif';
  }

  // WebP: "RIFF" at 0-3 and "WEBP" at 8-11
  if (
    startsWith(buffer, [0x52, 0x49, 0x46, 0x46]) &&
    bytesAt(buffer, 8, [0x57, 0x45, 0x42, 0x50])
  ) {
    return 'image/webp';
  }

  return null;
}
