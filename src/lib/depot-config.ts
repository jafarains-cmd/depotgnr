import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { pengaturan } from "@/db/schema/pengaturan";

/**
 * Baca lokasi titik depot dari pengaturan + jarak antar maksimum.
 * Dipakai untuk validasi jarak pengantaran ke pelanggan.
 */
export async function getDepotConfig(): Promise<{
  depotLat: number | null;
  depotLng: number | null;
  maxJarakAntarKm: number;
  kontakWA: string | null;
  kontakTelegram: string | null;
}> {
  const rows = await db.query.pengaturan.findMany({
    where: inArray(pengaturan.key, [
      "depotLat",
      "depotLng",
      "maxJarakAntarKm",
      "kontakWA",
      "kontakTelegram",
    ]),
  });
  const map = new Map(rows.map((r) => [r.key, r.value ?? ""]));

  const lat = Number(map.get("depotLat"));
  const lng = Number(map.get("depotLng"));
  const maxKm = Number(map.get("maxJarakAntarKm"));
  void eq;

  return {
    depotLat: Number.isFinite(lat) && lat !== 0 ? lat : null,
    depotLng: Number.isFinite(lng) && lng !== 0 ? lng : null,
    maxJarakAntarKm: Number.isFinite(maxKm) && maxKm > 0 ? maxKm : 10,
    kontakWA: map.get("kontakWA")?.trim() || null,
    kontakTelegram: map.get("kontakTelegram")?.trim() || null,
  };
}
