export const ACCEPTED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
export const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
const MAX_DIMENSION = 2400;
const KEEP_AS_IS_BYTES = 1.5 * 1024 * 1024;

export function validateImageFile(file: { type: string; size: number }): string | null {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) return 'Use a PNG, JPG, WebP or GIF image.';
  if (file.size > MAX_IMAGE_BYTES) return 'That image is over 15 MB.';
  return null;
}

// fit within the largest size and aspect ratio a screen needs.
export function fitWithin(width: number, height: number, max = MAX_DIMENSION): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

// big photos are shrunk so a few themes do not fill the browser's storage.
// small images are kept exactly as uploaded.
export async function prepareImage(file: File): Promise<Blob> {
  const problem = validateImageFile(file);
  if (problem) throw new Error(problem);
  const bitmap = await createImageBitmap(file);
  const { width, height } = fitWithin(bitmap.width, bitmap.height);
  if (width === bitmap.width && file.size <= KEEP_AS_IS_BYTES) {
    bitmap.close();
    return file;
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/webp', 0.88));
  if (!blob) throw new Error('Could not process that image.');
  return blob;
}
