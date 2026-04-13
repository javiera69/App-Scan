const DEFAULT_MAX_WIDTH = 1280;
const DEFAULT_QUALITY = 0.7;
const SIZE_WARNING_THRESHOLD = 1_000_000; // 1 MB in bytes (base64 chars ≈ bytes * 4/3)

export interface CompressionOptions {
  maxWidth?: number;
  quality?: number;
}

/**
 * Compresses an image file to JPEG, resizing to fit within maxWidth while
 * preserving aspect ratio. Returns raw base64 string (no data-URL prefix),
 * matching the format expected by aiService.ts.
 */
export async function compressImageToBase64(
  file: File,
  opts: CompressionOptions = {}
): Promise<string> {
  const maxWidth = opts.maxWidth ?? DEFAULT_MAX_WIDTH;
  const quality = opts.quality ?? DEFAULT_QUALITY;

  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxWidth / bitmap.width);
  const targetW = Math.max(1, Math.round(bitmap.width * scale));
  const targetH = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas 2D context not available');
  }
  ctx.drawImage(bitmap, 0, 0, targetW, targetH);
  bitmap.close();

  const blob: Blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('canvas.toBlob() returned null'))),
      'image/jpeg',
      quality
    );
  });

  const base64DataUrl: string = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

  // Strip the "data:image/jpeg;base64," prefix
  const base64 = base64DataUrl.split(',')[1] ?? '';

  if (base64.length > SIZE_WARNING_THRESHOLD) {
    const approxSizeKB = Math.round((base64.length * 3) / (4 * 1024));
    console.warn(
      `[imageCompression] Compressed image is still large (~${approxSizeKB} KB). ` +
      `The request may fail due to payload size limits.`
    );
  }

  return base64;
}
