/**
 * High-level wrapper untuk kirim bytes ke printer thermal via Bluetooth.
 * Cuma bisa jalan di Capacitor Android (deteksi via window.Capacitor).
 * Di browser web / SSR → throw error dengan pesan jelas.
 *
 * Preferences (paper size + printer MAC address) disimpan di localStorage
 * per HP — tidak butuh server round-trip untuk print.
 */

import type { PaperSize } from "./escpos";

const LS_KEY_PRINTER = "thermalPrinterAddress";
const LS_KEY_PRINTER_NAME = "thermalPrinterName";
const LS_KEY_PAPER = "thermalPaperSize";

export type ThermalPrefs = {
  address: string | null;
  name: string | null;
  paperSize: PaperSize;
};

export function isCapacitorNative(): boolean {
  if (typeof window === "undefined") return false;
  const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } })
    .Capacitor;
  return !!cap?.isNativePlatform?.();
}

export function getThermalPrefs(): ThermalPrefs {
  if (typeof window === "undefined") {
    return { address: null, name: null, paperSize: 58 };
  }
  const address = localStorage.getItem(LS_KEY_PRINTER);
  const name = localStorage.getItem(LS_KEY_PRINTER_NAME);
  const paperRaw = localStorage.getItem(LS_KEY_PAPER);
  const paperSize: PaperSize = paperRaw === "80" ? 80 : 58;
  return { address, name, paperSize };
}

export function setThermalPrinter(address: string, name: string): void {
  localStorage.setItem(LS_KEY_PRINTER, address);
  localStorage.setItem(LS_KEY_PRINTER_NAME, name);
}

export function clearThermalPrinter(): void {
  localStorage.removeItem(LS_KEY_PRINTER);
  localStorage.removeItem(LS_KEY_PRINTER_NAME);
}

export function setPaperSize(size: PaperSize): void {
  localStorage.setItem(LS_KEY_PAPER, String(size));
}

export type PairedDevice = { address: string; name: string };

/**
 * List printer yang sudah paired di HP (from OS Bluetooth settings).
 * User harus paired dulu manual via Settings HP → Bluetooth sebelum print.
 */
export async function listPairedPrinters(): Promise<PairedDevice[]> {
  if (!isCapacitorNative()) {
    throw new Error("Bluetooth print hanya bekerja di APK Android.");
  }
  const { BluetoothSerial } = await import("@ascentio-it/capacitor-bluetooth-serial");

  // Cek permission + enabled
  const permOk = await BluetoothSerial.checkBluetoothPermissions();
  if (!permOk) {
    throw new Error("Izin Bluetooth ditolak. Aktifkan di Settings HP.");
  }
  const state = await BluetoothSerial.isEnabled();
  if (!state.enabled) {
    await BluetoothSerial.enable();
  }

  const { devices } = await BluetoothSerial.getPairedDevices();
  return devices.map((d) => ({ address: d.address, name: d.name }));
}

/**
 * Print raw byte array ke printer default (dari localStorage). Kalau belum
 * ada printer default → throw.
 */
export async function printBytes(bytes: number[]): Promise<void> {
  if (!isCapacitorNative()) {
    throw new Error("Bluetooth print hanya bekerja di APK Android.");
  }
  const prefs = getThermalPrefs();
  if (!prefs.address) {
    throw new Error(
      "Printer default belum di-set. Buka Pengaturan Printer di app dulu.",
    );
  }
  const { BluetoothSerial } = await import("@ascentio-it/capacitor-bluetooth-serial");

  // Connect (skip kalau sudah connected)
  let alreadyConnected = false;
  try {
    const status = await BluetoothSerial.isConnected({ address: prefs.address });
    alreadyConnected = status.connected;
  } catch {
    // ignore, assume not connected
  }

  if (!alreadyConnected) {
    try {
      await BluetoothSerial.connect({ address: prefs.address });
    } catch (e) {
      throw new Error(
        `Gagal connect ke printer (${prefs.name}). Cek printer ON + range dekat. (${e instanceof Error ? e.message : String(e)})`,
      );
    }
  }

  // Plugin ascentio write value=string, encode ke UTF-8. Kita kirim bytes
  // sebagai string dgn charcode = byte value. Semua ESC/POS command yg kita
  // pakai <= 0x7F (ASCII safe), jadi UTF-8 encoding tidak corrupt.
  const strValue = String.fromCharCode(...bytes);
  try {
    await BluetoothSerial.write({
      address: prefs.address,
      value: strValue,
    });
  } finally {
    try {
      await BluetoothSerial.disconnect({ address: prefs.address });
    } catch {
      // ignore
    }
  }
}
