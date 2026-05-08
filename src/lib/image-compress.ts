/**
 * Client-side image compression. Resize ke max width, output JPEG dengan
 * quality tertentu. Pakai canvas — gak perlu library tambahan.
 *
 * Kalau file bukan image (mis. PDF), return as-is.
 */
export async function compressImage(
  file: File,
  options: { maxWidth?: number; quality?: number } = {},
): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  // Skip kalau sudah cukup kecil (<500KB)
  if (file.size < 500 * 1024) return file;

  const { maxWidth = 1600, quality = 0.85 } = options;

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = dataUrl;
  });

  const ratio = img.width > maxWidth ? maxWidth / img.width : 1;
  const w = Math.round(img.width * ratio);
  const h = Math.round(img.height * ratio);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(img, 0, 0, w, h);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", quality),
  );
  if (!blob) return file;

  return new File([blob], file.name.replace(/\.\w+$/, ".jpg"), {
    type: "image/jpeg",
    lastModified: Date.now(),
  });
}

/**
 * Convert ArrayBuffer ke base64 string. Pakai chunked loop untuk hindari
 * "Maximum call stack size exceeded" pada file besar.
 */
export function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  const chunkSize = 0x8000; // 32KB
  let s = "";
  for (let i = 0; i < bytes.length; i += chunkSize) {
    s += String.fromCharCode.apply(
      null,
      Array.from(bytes.subarray(i, i + chunkSize)),
    );
  }
  return btoa(s);
}
