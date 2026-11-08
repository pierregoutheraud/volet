/** Base64 of raw bytes, for inline `data:` images (the worker has no FileReader). */
export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

/**
 * Shrink a screenshot to `width` pixels across (never wider than it was), as a JPEG `data:` URL. Captures come at the
 * display's full resolution, hundreds of kilobytes each, for a preview card a few hundred pixels wide.
 */
export async function downscaleJpeg(dataUrl: string, width: number, quality = 0.7): Promise<string> {
  const source = await (await fetch(dataUrl)).blob();
  const original = await createImageBitmap(source);
  const scaled = original.width > width
    ? await createImageBitmap(original, { resizeWidth: width, resizeQuality: 'medium' })
    : original;
  const canvas = new OffscreenCanvas(scaled.width, scaled.height);
  canvas.getContext('2d')!.drawImage(scaled, 0, 0);
  original.close();
  scaled.close();
  const image = await canvas.convertToBlob({ type: 'image/jpeg', quality });
  return `data:image/jpeg;base64,${bytesToBase64(new Uint8Array(await image.arrayBuffer()))}`;
}
