/**
 * Normalize Google Drive URL → format yang bisa di-embed sebagai <img>.
 *
 * URL "uc?id=" tidak bisa di-embed langsung (CORS/rate-limit). Pakai
 * lh3.googleusercontent.com/d/<id> yang dirancang untuk hotlinking.
 *
 * Pattern yang di-recognize:
 *  - drive.google.com/uc?id=<ID>
 *  - drive.google.com/file/d/<ID>/view
 *  - drive.usercontent.google.com/download?id=<ID>
 *  - lh3.googleusercontent.com/d/<ID> (sudah benar, biarkan)
 *  - URL lain → return apa adanya
 */
export function normalizeDriveUrl(url: string | null | undefined): string {
  if (!url) return "";
  const m =
    url.match(/[?&]id=([a-zA-Z0-9_-]{20,})/) ||
    url.match(/\/file\/d\/([a-zA-Z0-9_-]{20,})/) ||
    url.match(/lh3\.googleusercontent\.com\/d\/([a-zA-Z0-9_-]{20,})/);
  if (!m) return url;
  const id = m[1];
  return `https://lh3.googleusercontent.com/d/${id}`;
}
