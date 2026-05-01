/**
 * Best-effort wrapper untuk operation yang TIDAK boleh menggagalkan flow utama,
 * tapi error-nya tetap perlu di-LOG (bukan silent swallow).
 *
 * Pakai ini untuk:
 * - Sync ke external service (Sheets, WA, Telegram, Push)
 * - Earn loyalty / referral hooks (jangan blok transaksi tapi catat kalau gagal)
 *
 * JANGAN pakai untuk operation kritis yang user butuh feedback (mis. simpan order).
 */
export function bestEffort<T>(label: string, promise: Promise<T>): Promise<T | null> {
  return promise.catch((e) => {
    const msg = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
    console.error(`[best-effort] ${label} failed:`, msg);
    if (e instanceof Error && e.stack) console.error(e.stack);
    return null;
  });
}

/**
 * Versi sync untuk fungsi yang return Promise (bukan langsung promise).
 * Pakai: bestEffortAsync("label", () => doSomething())
 */
export function bestEffortAsync<T>(label: string, fn: () => Promise<T>): Promise<T | null> {
  try {
    return bestEffort(label, fn());
  } catch (e) {
    const msg = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
    console.error(`[best-effort] ${label} threw sync:`, msg);
    return Promise.resolve(null);
  }
}
