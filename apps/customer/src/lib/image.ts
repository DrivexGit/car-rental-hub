import { translate as t } from "@/lib/i18n";

export const MAX_PHOTO_INPUT = 10 * 1024 * 1024; // refuse absurd files before decoding

/** Centre-crops to a square and shrinks to `size` px. WebP where the browser can encode it, JPEG otherwise (Safari). */
export async function compressSquare(file: File, size = 512): Promise<Blob> {
  if (!file.type.startsWith("image/")) throw new Error(t("Please choose an image file."));
  if (file.size > MAX_PHOTO_INPUT) throw new Error(t("That photo is too large. Choose one under 10 MB."));

  let bitmap: ImageBitmap;
  try { bitmap = await createImageBitmap(file); } catch { throw new Error(t("We could not read that image. Try a JPG or PNG.")); }
  const side = Math.min(bitmap.width, bitmap.height);
  const out = Math.min(size, side);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = out;
  canvas.getContext("2d")!.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, out, out);
  bitmap.close();

  const toBlob = (type: string, q: number) => new Promise<Blob | null>((r) => canvas.toBlob(r, type, q));
  const webp = await toBlob("image/webp", 0.85);
  const blob = webp?.type === "image/webp" ? webp : await toBlob("image/jpeg", 0.85);
  if (!blob) throw new Error(t("We could not process that image."));
  return blob;
}
