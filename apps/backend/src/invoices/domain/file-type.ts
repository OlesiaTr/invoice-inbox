export type SupportedMimeType = 'application/pdf' | 'image/png' | 'image/jpeg' | 'image/webp';

export const EXTENSIONS: Record<SupportedMimeType, string> = {
  'application/pdf': 'pdf',
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};

const startsWith = (buf: Buffer, bytes: number[], offset = 0) =>
  buf.length >= offset + bytes.length && bytes.every((b, i) => buf[offset + i] === b);

/**
 * Detects the real file type from its first bytes ("magic numbers"). The extension and
 * the browser-sent Content-Type are user-controlled, so they are never trusted.
 */
export function detectFileType(buf: Buffer): SupportedMimeType | null {
  if (startsWith(buf, [0x25, 0x50, 0x44, 0x46, 0x2d])) return 'application/pdf'; // %PDF-
  if (startsWith(buf, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';
  if (startsWith(buf, [0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (startsWith(buf, [0x52, 0x49, 0x46, 0x46]) && startsWith(buf, [0x57, 0x45, 0x42, 0x50], 8)) {
    return 'image/webp'; // RIFF....WEBP
  }
  return null;
}
