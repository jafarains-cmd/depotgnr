import { redirect } from "next/navigation";

export default function TransaksiAdminRedirect() {
  // Admin lihat semua transaksi via /kasir/transaksi (akses sudah dicek di sana)
  redirect("/kasir/transaksi");
}
