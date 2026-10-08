export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];

/** Returns a message when the file cannot be used as a car photo, or '' when it is fine. */
export const checkImageFile = (f: { name: string; type: string; size: number }) =>
  !IMAGE_TYPES.includes(f.type) ? `${f.name}: use a JPG, PNG or WebP image (iPhone HEIC photos are not supported, export as JPG).`
    : f.size > MAX_IMAGE_BYTES ? `${f.name}: the file is larger than 8 MB.` : '';
