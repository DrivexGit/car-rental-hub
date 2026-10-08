import { describe, expect, it } from 'vitest';
import { checkImageFile, MAX_IMAGE_BYTES } from './photoFile';

const f = (type: string, size = 1000, name = 'car.jpg') => ({ name, type, size });

describe('checkImageFile', () => {
  it('accepts JPG, PNG, WebP and AVIF', () => {
    for (const t of ['image/jpeg', 'image/png', 'image/webp', 'image/avif']) expect(checkImageFile(f(t))).toBe('');
  });
  it('rejects HEIC with a helpful message', () => {
    expect(checkImageFile(f('image/heic', 1000, 'IMG_1.HEIC'))).toMatch(/IMG_1\.HEIC.*JPG/);
  });
  it('rejects non-images and empty types', () => {
    expect(checkImageFile(f('application/pdf'))).not.toBe('');
    expect(checkImageFile(f(''))).not.toBe('');
  });
  it('rejects files over 8 MB but allows exactly 8 MB', () => {
    expect(checkImageFile(f('image/jpeg', MAX_IMAGE_BYTES))).toBe('');
    expect(checkImageFile(f('image/jpeg', MAX_IMAGE_BYTES + 1))).toMatch(/8 MB/);
  });
});
