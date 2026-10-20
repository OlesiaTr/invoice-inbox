import { detectFileType } from './file-type';

describe('detectFileType', () => {
  it('detects by magic bytes, not by name', () => {
    expect(detectFileType(Buffer.from('%PDF-1.7\n...'))).toBe('application/pdf');
    expect(detectFileType(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]))).toBe('image/png');
    expect(detectFileType(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))).toBe('image/jpeg');
    expect(detectFileType(Buffer.from('RIFF\0\0\0\0WEBPVP8 '))).toBe('image/webp');
  });

  it('rejects anything else, including disguised files', () => {
    expect(detectFileType(Buffer.from('<html>%PDF-'))).toBeNull();
    expect(detectFileType(Buffer.from('MZ\x90\0'))).toBeNull(); // an .exe renamed to .pdf
    expect(detectFileType(Buffer.from('RIFF\0\0\0\0WAVE'))).toBeNull();
    expect(detectFileType(Buffer.alloc(0))).toBeNull();
  });
});
