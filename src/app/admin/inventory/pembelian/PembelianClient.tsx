"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  X,
  Loader2,
  Package,
  Users,
} from "lucide-react";
import {
  catatPembelianGalon,
  saveSupplier,
  toggleSupplierAktif,
} from "./actions";
import { formatRupiah } from "@/lib/utils";

type Produk = { id: number; nama: string; brand: string | null; hargaPokok: number };
type Supplier = {
  id: number;
  nama: string;
  telp: string | null;
  alamat: string | null;
  catatan: string | null;
  aktif: boolean;
};

export function PembelianClient({
  produkList,
  supplierList,
}: {
  produkList: Produk[];
  supplierList: Supplier[];
}) {
  const [openBeli, setOpenBeli] = useState(false);
  const [openSupplier, setOpenSupplier] = useState(false);

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setOpenSupplier(true)}
          className="inline-flex items-center gap-1.5 px-3 py-2 border border-line rounded-lg text-sm font-bold hover:bg-surface transition"
        >
          <Users size={14} /> Kelola Supplier
        </button>
        <button
          onClick={() => setOpenBeli(true)}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-bold hover:bg-emerald-700 transition"
        >
          <Plus size={14} /> Beli Galon
        </button>
      </div>

      {openBeli && (
        <BeliGalonModal
          produkList={produkList}
          supplierList={supplierList}
          onClose={() => setOpenBeli(false)}
        />
      )}
      {openSupplier && (
        <KelolaSupplierModal
          supplierList={supplierList}
          onClose={() => setOpenSupplier(false)}
        />
      )}
    </>
  );
}

function BeliGalonModal({
  produkList,
  supplierList,
  onClose,
}: {
  produkList: Produk[];
  supplierList: Supplier[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const today = new Date().toISOString().slice(0, 10);
  const [tanggal, setTanggal] = useState(today);
  const [produkId, setProdukId] = useState(produkList[0]?.id ?? 0);
  const [supplierId, setSupplierId] = useState<number | "">("");
  const [jenis, setJenis] = useState<"kosong" | "terisi">("kosong");
  const [jumlah, setJumlah] = useState("");
  const [hargaSatuan, setHargaSatuan] = useState("");
  const [noInvoice, setNoInvoice] = useState("");
  const [catatan, setCatatan] = useState("");
  const [fotoBase64, setFotoBase64] = useState<string | null>(null);
  const [fotoMime, setFotoMime] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const jumlahNum = parseInt(jumlah.replace(/\D/g, ""), 10) || 0;
  const hargaNum = parseInt(hargaSatuan.replace(/\D/g, ""), 10) || 0;
  const total = jumlahNum * hargaNum;

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(",")[1];
      setFotoBase64(base64);
      setFotoMime(file.type);
    };
    reader.readAsDataURL(file);
  }

  function submit() {
    setErr(null);
    if (!produkId) {
      setErr("Pilih produk");
      return;
    }
    if (jumlahNum <= 0) {
      setErr("Jumlah harus > 0");
      return;
    }
    if (hargaNum <= 0) {
      setErr("Harga per galon harus > 0");
      return;
    }
    startTransition(async () => {
      const res = await catatPembelianGalon({
        tanggal,
        produkId,
        supplierId: supplierId === "" ? null : Number(supplierId),
        jenis,
        jumlah: jumlahNum,
        hargaSatuan: hargaNum,
        noInvoice: noInvoice.trim() || undefined,
        catatan: catatan.trim() || undefined,
        fotoNotaBase64: fotoBase64 ?? undefined,
        fotoNotaMimeType: fotoMime ?? undefined,
      });
      if ("error" in res) {
        setErr(res.error);
        return;
      }
      onClose();
      router.refresh();
    });
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 grid place-items-center p-4 overflow-auto">
      <div className="bg-surface rounded-2xl max-w-lg w-full p-5 space-y-3 my-4">
        <div className="flex justify-between items-start">
          <h2 className="font-bold text-lg inline-flex items-center gap-1.5">
            <Package size={18} className="text-emerald-600" /> Beli Galon
          </h2>
          <button onClick={onClose} disabled={pending}>
            <X size={20} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-bold block mb-1">Tanggal</label>
            <input
              type="date"
              value={tanggal}
              onChange={(e) => setTanggal(e.target.value)}
              className="w-full px-3 py-2 border border-line rounded-md text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-bold block mb-1">Jenis Galon</label>
            <div className="grid grid-cols-2 gap-1 border border-line rounded-md p-0.5">
              <button
                type="button"
                onClick={() => setJenis("kosong")}
                className={`py-1.5 text-xs font-bold rounded ${
                  jenis === "kosong"
                    ? "bg-sky-600 text-white"
                    : "text-[color:var(--muted)]"
                }`}
              >
                Kosong
              </button>
              <button
                type="button"
                onClick={() => setJenis("terisi")}
                className={`py-1.5 text-xs font-bold rounded ${
                  jenis === "terisi"
                    ? "bg-emerald-600 text-white"
                    : "text-[color:var(--muted)]"
                }`}
              >
                Terisi
              </button>
            </div>
          </div>
        </div>

        <div className="text-[11px] text-[color:var(--muted)] bg-brand-soft border border-brand/20 rounded p-2">
          {jenis === "kosong" ? (
            <>
              <b>Beli Kosong:</b> galon kosong untuk pool pinjaman pelanggan
              order banyak, atau siap-tukar. Stok kosong bertambah.
            </>
          ) : (
            <>
              <b>Beli Terisi:</b> beli galon sudah berisi dari brand lain
              (mis. AQUA, Le Minerale) untuk dijual kembali. Stok terisi
              bertambah.
            </>
          )}
        </div>

        <div>
          <label className="text-xs font-bold block mb-1">Produk</label>
          <select
            value={produkId}
            onChange={(e) => setProdukId(Number(e.target.value))}
            className="w-full px-3 py-2 border border-line rounded-md text-sm bg-surface"
          >
            {produkList.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nama}
                {p.brand ? ` (${p.brand})` : ""}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs font-bold block mb-1">
            Supplier (opsional)
          </label>
          <select
            value={supplierId}
            onChange={(e) =>
              setSupplierId(e.target.value === "" ? "" : Number(e.target.value))
            }
            className="w-full px-3 py-2 border border-line rounded-md text-sm bg-surface"
          >
            <option value="">— Tidak dipilih —</option>
            {supplierList.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nama}
                {s.telp ? ` · ${s.telp}` : ""}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-bold block mb-1">
              Jumlah (galon)
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={jumlah}
              onChange={(e) => setJumlah(e.target.value.replace(/\D/g, ""))}
              placeholder="20"
              className="w-full px-3 py-2 border border-line rounded-md text-lg font-mono font-bold"
              autoFocus
            />
          </div>
          <div>
            <label className="text-xs font-bold block mb-1">
              Harga per Galon
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={hargaSatuan}
              onChange={(e) => setHargaSatuan(e.target.value.replace(/\D/g, ""))}
              placeholder="30000"
              className="w-full px-3 py-2 border border-line rounded-md text-lg font-mono font-bold"
            />
          </div>
        </div>

        {total > 0 && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2 text-sm text-center">
            <span className="text-[color:var(--muted)]">Total: </span>
            <b className="text-emerald-700 text-lg">{formatRupiah(total)}</b>
            <div className="text-[10px] text-[color:var(--muted)]">
              Auto masuk pengeluaran kategori &quot;beli-galon&quot;
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-bold block mb-1">
              No. Invoice (opsional)
            </label>
            <input
              type="text"
              value={noInvoice}
              onChange={(e) => setNoInvoice(e.target.value)}
              placeholder="INV-2026-089"
              className="w-full px-3 py-2 border border-line rounded-md text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-bold block mb-1">
              Foto Nota (opsional)
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={handleFile}
              className="w-full text-xs"
            />
            {fotoBase64 && (
              <div className="text-[10px] text-emerald-700 mt-1">
                ✓ Foto siap diupload
              </div>
            )}
          </div>
        </div>

        <div>
          <label className="text-xs font-bold block mb-1">
            Catatan (opsional)
          </label>
          <input
            type="text"
            value={catatan}
            onChange={(e) => setCatatan(e.target.value)}
            placeholder="Batch bulan ini, kualitas bagus"
            className="w-full px-3 py-2 border border-line rounded-md text-sm"
          />
        </div>

        {err && <div className="text-xs text-red-600 font-bold">{err}</div>}

        <div className="flex justify-end gap-2 pt-2 border-t border-line">
          <button
            onClick={onClose}
            disabled={pending}
            className="px-4 py-2 border border-line rounded-md text-sm"
          >
            Batal
          </button>
          <button
            onClick={submit}
            disabled={pending || !jumlahNum || !hargaNum}
            className="px-4 py-2 bg-emerald-600 text-white rounded-md text-sm font-bold inline-flex items-center gap-1.5 disabled:opacity-50"
          >
            {pending && <Loader2 size={14} className="animate-spin" />}
            Simpan Pembelian
          </button>
        </div>
      </div>
    </div>
  );
}

function KelolaSupplierModal({
  supplierList,
  onClose,
}: {
  supplierList: Supplier[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [nama, setNama] = useState("");
  const [telp, setTelp] = useState("");
  const [alamat, setAlamat] = useState("");
  const [catatan, setCatatan] = useState("");
  const [err, setErr] = useState<string | null>(null);

  function openForm(s?: Supplier) {
    if (s) {
      setEditing(s);
      setNama(s.nama);
      setTelp(s.telp ?? "");
      setAlamat(s.alamat ?? "");
      setCatatan(s.catatan ?? "");
    } else {
      setEditing(null);
      setNama("");
      setTelp("");
      setAlamat("");
      setCatatan("");
    }
    setShowForm(true);
    setErr(null);
  }

  function submit() {
    setErr(null);
    if (nama.trim().length < 2) {
      setErr("Nama supplier min 2 karakter");
      return;
    }
    startTransition(async () => {
      const res = await saveSupplier({
        id: editing?.id,
        nama: nama.trim(),
        telp: telp.trim() || undefined,
        alamat: alamat.trim() || undefined,
        catatan: catatan.trim() || undefined,
      });
      if ("error" in res) {
        setErr(res.error);
        return;
      }
      setShowForm(false);
      router.refresh();
    });
  }

  function toggle(id: number) {
    startTransition(async () => {
      await toggleSupplierAktif(id);
      router.refresh();
    });
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 grid place-items-center p-4 overflow-auto">
      <div className="bg-surface rounded-2xl max-w-lg w-full p-5 space-y-3 my-4">
        <div className="flex justify-between items-start">
          <h2 className="font-bold text-lg inline-flex items-center gap-1.5">
            <Users size={18} className="text-brand" /> Kelola Supplier
          </h2>
          <button onClick={onClose} disabled={pending}>
            <X size={20} />
          </button>
        </div>

        {!showForm ? (
          <>
            <button
              onClick={() => openForm()}
              className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-600 text-white rounded-lg text-sm font-bold hover:bg-emerald-700"
            >
              <Plus size={14} /> Tambah Supplier
            </button>

            {supplierList.length === 0 ? (
              <div className="text-xs text-[color:var(--muted)] italic text-center py-4">
                Belum ada supplier. Klik &quot;Tambah Supplier&quot; untuk mulai.
              </div>
            ) : (
              <div className="max-h-[400px] overflow-y-auto space-y-1.5">
                {supplierList.map((s) => (
                  <div
                    key={s.id}
                    className={`border border-line rounded-lg p-2.5 ${
                      s.aktif ? "" : "opacity-50"
                    }`}
                  >
                    <div className="flex justify-between items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-sm">{s.nama}</div>
                        {s.telp && (
                          <div className="text-[10px] text-[color:var(--muted)]">
                            📞 {s.telp}
                          </div>
                        )}
                        {s.alamat && (
                          <div className="text-[10px] text-[color:var(--muted)] truncate">
                            📍 {s.alamat}
                          </div>
                        )}
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => openForm(s)}
                          className="text-xs text-brand hover:underline px-2 py-1"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => toggle(s.id)}
                          disabled={pending}
                          className={`text-xs px-2 py-1 rounded ${
                            s.aktif
                              ? "text-red-600 hover:bg-red-50"
                              : "text-emerald-600 hover:bg-emerald-50"
                          }`}
                        >
                          {s.aktif ? "Non-aktifkan" : "Aktifkan"}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            <div className="text-xs font-bold text-[color:var(--muted)]">
              {editing ? `Edit ${editing.nama}` : "Tambah Supplier Baru"}
            </div>
            <div>
              <label className="text-xs font-bold block mb-1">
                Nama (min 2 karakter)
              </label>
              <input
                type="text"
                value={nama}
                onChange={(e) => setNama(e.target.value)}
                placeholder="PT Tirta AQUA"
                className="w-full px-3 py-2 border border-line rounded-md text-sm"
                autoFocus
              />
            </div>
            <div>
              <label className="text-xs font-bold block mb-1">
                Telp (opsional)
              </label>
              <input
                type="text"
                value={telp}
                onChange={(e) => setTelp(e.target.value)}
                placeholder="0812xxx"
                className="w-full px-3 py-2 border border-line rounded-md text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-bold block mb-1">
                Alamat (opsional)
              </label>
              <input
                type="text"
                value={alamat}
                onChange={(e) => setAlamat(e.target.value)}
                placeholder="Jl. Distribusi No. 123"
                className="w-full px-3 py-2 border border-line rounded-md text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-bold block mb-1">
                Catatan (opsional)
              </label>
              <input
                type="text"
                value={catatan}
                onChange={(e) => setCatatan(e.target.value)}
                placeholder="Diskon 5% kalau ambil > 50 galon"
                className="w-full px-3 py-2 border border-line rounded-md text-sm"
              />
            </div>

            {err && <div className="text-xs text-red-600 font-bold">{err}</div>}

            <div className="flex gap-2">
              <button
                onClick={submit}
                disabled={pending}
                className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-md text-sm font-bold disabled:opacity-50"
              >
                {pending ? "Menyimpan…" : "Simpan"}
              </button>
              <button
                onClick={() => setShowForm(false)}
                disabled={pending}
                className="px-4 py-2 border border-line rounded-md text-sm"
              >
                Batal
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
