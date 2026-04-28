import { PageHeader } from "@/components/AppShell";
import { APPS_SCRIPT_CODE } from "@/lib/appsScriptCode";
import { CodeBlock } from "./CodeBlock";

export default function BantuanPage() {
  const baseUrl = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";

  return (
    <div className="p-6 max-w-4xl">
      <PageHeader
        title="Bantuan & Setup"
        description="Panduan konfigurasi integrasi (Sheets, Telegram, WhatsApp)."
      />

      <div className="space-y-8">
        <Section
          id="sheets"
          title="Google Sheets via Apps Script"
          summary="Sinkronkan data ke Google Sheet kamu tanpa service account."
        >
          <Step n={1} title="Buka Apps Script editor di Sheet kamu">
            <ul className="list-disc pl-5 space-y-0.5 text-sm">
              <li>Buka Google Sheet yang akan dipakai (sheet apa pun, di akun apa pun).</li>
              <li>Menu <b>Extensions</b> → <b>Apps Script</b> → editor terbuka di tab baru.</li>
              <li>Hapus seluruh isi default <code>Code.gs</code>.</li>
            </ul>
          </Step>

          <Step n={2} title="Paste kode di bawah ke editor">
            <p className="text-sm text-slate-600 mb-2">
              Klik tombol <b>Copy</b>, paste ke editor Apps Script, lalu ganti baris{" "}
              <code className="bg-slate-100 px-1 rounded">const TOKEN = "..."</code> dengan
              string acak panjang (≥24 karakter). Simpan dengan <kbd>Ctrl+S</kbd>.
            </p>
            <CodeBlock code={APPS_SCRIPT_CODE} language="javascript" />
            <p className="text-xs text-slate-500 mt-2">
              Tip generate token: di terminal jalankan{" "}
              <code className="bg-slate-100 px-1 rounded">openssl rand -hex 24</code>, atau pakai
              hasil random dari https://passwordsgenerator.net/.
            </p>
          </Step>

          <Step n={3} title="Deploy sebagai Web App">
            <ol className="list-decimal pl-5 space-y-0.5 text-sm">
              <li>Klik <b>Deploy</b> → <b>New deployment</b>.</li>
              <li>Klik gear icon ⚙ di kiri atas → pilih <b>Web app</b>.</li>
              <li>Description: <code>Depot Air Bridge</code></li>
              <li><b>Execute as</b>: Me</li>
              <li><b>Who has access</b>: Anyone</li>
              <li>Klik <b>Deploy</b> → otorisasi (Authorize → pilih akun → Allow).</li>
              <li>Salin <b>Web app URL</b> (bentuk: <code>https://script.google.com/macros/s/.../exec</code>).</li>
            </ol>
          </Step>

          <Step n={4} title="Pasang URL & Token di aplikasi">
            <ol className="list-decimal pl-5 space-y-0.5 text-sm">
              <li>Buka <a href="/admin/pengaturan" className="text-brand-600 underline">/admin/pengaturan</a>.</li>
              <li>Tempel <b>Web app URL</b> ke field <b>Apps Script Web App URL</b>.</li>
              <li>Tempel <b>TOKEN yang sama</b> dengan di Apps Script ke field <b>Apps Script Token</b>.</li>
              <li>Klik <b>Simpan</b>.</li>
              <li>Klik <b>Test Koneksi</b> di kotak Sheets Sync. Harus muncul: <i>Test koneksi berhasil: pong</i>.</li>
              <li>Klik <b>Inisialisasi Tab + Header</b> → tab <code>Transaksi</code>, <code>Order</code>, <code>Produk</code> terbuat di sheet kamu.</li>
            </ol>
          </Step>

          <Step n={5} title="Update kode di kemudian hari">
            <p className="text-sm">
              Edit kode di Apps Script editor → <b>Deploy</b> → <b>Manage deployments</b> → klik ✎
              edit pada deployment yang ada → <b>New version</b> → <b>Deploy</b>. URL & token tidak berubah.
            </p>
          </Step>
        </Section>

        <Section
          id="telegram"
          title="Bot Telegram"
          summary="Kirim notifikasi order ke admin & pelanggan via Telegram."
        >
          <Step n={1} title="Buat bot di @BotFather">
            <ol className="list-decimal pl-5 space-y-0.5 text-sm">
              <li>Buka Telegram → cari <code>@BotFather</code> → start.</li>
              <li>Kirim <code>/newbot</code> → ikuti petunjuk (kasih nama + username unik).</li>
              <li>Salin <b>HTTP API token</b> yang diberikan (bentuk: <code>1234567:ABC-...</code>).</li>
            </ol>
          </Step>

          <Step n={2} title="Cari Chat ID admin">
            <ol className="list-decimal pl-5 space-y-0.5 text-sm">
              <li>Cari bot kamu di Telegram → start (kirim <code>/start</code>).</li>
              <li>Buka di browser: <code className="bg-slate-100 px-1 rounded break-all">https://api.telegram.org/bot&lt;TOKEN&gt;/getUpdates</code></li>
              <li>Cari <code>chat.id</code> di response — itu Chat ID kamu (number).</li>
            </ol>
          </Step>

          <Step n={3} title="Set di .env.local">
            <CodeBlock
              language="bash"
              code={`TELEGRAM_BOT_TOKEN=isi-token-bot-disini
ADMIN_TELEGRAM_CHAT_ID=isi-chat-id-admin-disini
# bisa lebih dari satu admin, pisah koma:
# ADMIN_TELEGRAM_CHAT_ID=12345,67890`}
            />
            <p className="text-xs text-slate-500 mt-1">Restart dev server setelah edit.</p>
          </Step>

          <Step n={4} title="Pasang webhook">
            <p className="text-sm mb-2">
              Webhook butuh URL publik. Untuk dev pakai{" "}
              <a href="https://ngrok.com/" target="_blank" rel="noopener" className="text-brand-600 underline">
                ngrok
              </a>{" "}
              (jalankan <code>ngrok http 3000</code>, salin URL https-nya, set sebagai{" "}
              <code>BETTER_AUTH_URL</code> di .env, restart). Untuk produksi pakai domain server.
            </p>
            <p className="text-sm">
              Lalu buka <a href="/admin/pengaturan" className="text-brand-600 underline">/admin/pengaturan</a> →
              klik <b>Pasang Webhook</b> di kotak Telegram.
            </p>
          </Step>

          <Step n={5} title="(Opsional) Pasang bot di Grup Telegram dengan Topic">
            <p className="text-sm mb-2">
              Notifikasi order bisa dikirim ke <b>grup Telegram dengan topics</b> (forum mode), satu topic per status order. Cocok untuk dipantau ramai-ramai oleh admin + kurir.
            </p>
            <ol className="list-decimal pl-5 space-y-1 text-sm">
              <li>Buat grup Telegram → ke <b>Manage Group</b> → <b>Topics</b> → enable.</li>
              <li>
                Buat 5 topic (boleh nama beda): <code>Semua Orderan</code>, <code>Pending</code>,{" "}
                <code>Diproses</code>, <code>Diantar</code>, <code>Selesai</code>, <code>Batal</code>.
              </li>
              <li>
                Tambah bot ke grup (search username bot → Add). Promote bot jadi <b>admin</b> minimal dengan permission <i>Send Messages</i> dan <i>Manage Topics</i>.
              </li>
              <li>
                Di grup, kirim <code>/chatid</code> → bot reply <b>Chat ID</b> grup (negatif, mis.{" "}
                <code>-1001234567890</code>). Salin → paste ke field{" "}
                <b>Telegram Group Chat ID</b> di /admin/pengaturan.
              </li>
              <li>
                Buka topic <b>Semua Orderan</b> → kirim <code>/topicid</code> → bot reply{" "}
                <b>Topic ID</b>. Salin → paste ke field <b>Topic ID — Semua Orderan</b>.
              </li>
              <li>
                Ulangi untuk tiap topic Pending/Diproses/Diantar/Selesai/Batal — masing-masing kirim{" "}
                <code>/topicid</code> di topic-nya, isi field yang sesuai.
              </li>
              <li>
                Klik <b>Simpan</b>. Setiap order baru auto post ke topic <b>Pending</b> + <b>Semua Orderan</b>. Setiap status berubah auto post ke topic status baru + Semua Orderan.
              </li>
            </ol>
            <p className="text-xs text-slate-500 mt-2">
              Grup chat ID kosong = fallback ke DM admin lewat <code>ADMIN_TELEGRAM_CHAT_ID</code> env (perilaku lama). Topic ID kosong = post ke main chat tanpa thread.
            </p>
          </Step>

          <Step n={6} title="Pelanggan hubungkan akun">
            <p className="text-sm">
              Pelanggan login → <code>/pelanggan/profil</code> → <b>Generate Kode</b> →
              kirim <code>/start &lt;kode&gt;</code> ke bot. Setelah linked, pelanggan auto dapat
              notif saat order selesai.
            </p>
          </Step>
        </Section>

        <Section
          id="whatsapp"
          title="WhatsApp (Fonnte / Wablas)"
          summary="OTP login + notifikasi + bot order via WhatsApp."
        >
          <Step n={1} title="Pilih provider berbayar">
            <p className="text-sm">
              WhatsApp resmi tidak gratis untuk akun publik. Saran provider lokal Indonesia:
            </p>
            <ul className="list-disc pl-5 text-sm space-y-0.5">
              <li><a href="https://fonnte.com" target="_blank" rel="noopener" className="text-brand-600 underline">Fonnte</a> — paket mulai 50rb/bulan, REST API stabil.</li>
              <li><a href="https://wablas.com" target="_blank" rel="noopener" className="text-brand-600 underline">Wablas</a> — alternatif serupa.</li>
            </ul>
          </Step>

          <Step n={2} title="Daftar device di provider">
            <p className="text-sm">
              Daftar akun → daftarkan satu nomor WA aktif sebagai device → scan QR seperti
              WhatsApp Web. Dapat <b>API Key</b> dari dashboard provider.
            </p>
          </Step>

          <Step n={3} title="Set di .env.local">
            <CodeBlock
              language="bash"
              code={`WHATSAPP_PROVIDER=fonnte
WHATSAPP_API_KEY=isi-api-key-disini
WHATSAPP_API_URL=https://api.fonnte.com/send`}
            />
          </Step>

          <Step n={4} title="Pasang webhook untuk pesan masuk">
            <p className="text-sm">
              Di dashboard provider → cari menu <b>Webhook</b> → isi URL:
              <code className="bg-slate-100 px-2 py-0.5 rounded ml-1 text-xs break-all">
                {baseUrl}/api/webhooks/whatsapp
              </code>
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Untuk dev pakai ngrok URL.
            </p>
          </Step>

          <Step n={5} title="Test bot order">
            <p className="text-sm">
              Kirim ke nomor bot: <code>MENU</code> → katalog tampil. <code>ORDER</code> →
              wizard pesan. Cek <a href="/admin/order" className="text-brand-600 underline">/admin/order</a>{" "}
              untuk lihat order masuk.
            </p>
          </Step>
        </Section>

        <Section
          id="maps"
          title="Google Maps (Peta Pelanggan)"
          summary="Opsional. Kalau tidak diset, otomatis pakai OpenStreetMap (gratis tanpa key)."
        >
          <Step n={1} title="Buat API Key di Google Cloud">
            <ol className="list-decimal pl-5 space-y-0.5 text-sm">
              <li>Buka <a href="https://console.cloud.google.com/" target="_blank" rel="noopener" className="text-brand-600 underline">Google Cloud Console</a> → pilih project (atau buat baru).</li>
              <li>Aktifkan <b>Maps JavaScript API</b> di Library.</li>
              <li>Menu <b>APIs &amp; Services</b> → <b>Credentials</b> → <b>Create Credentials</b> → <b>API Key</b>.</li>
              <li>Klik nama API Key → di bagian "Application restrictions" pilih <b>HTTP referrers</b> → tambahkan domain kamu (mis. <code>localhost:3000/*</code>, <code>https://depot-air.com/*</code>) untuk security.</li>
              <li>Di "API restrictions" → pilih <b>Restrict key</b> → centang <b>Maps JavaScript API</b>.</li>
            </ol>
          </Step>
          <Step n={2} title="Tambahkan ke .env.local">
            <CodeBlock
              language="bash"
              code={`NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=AIzaSy....isi-api-key-disini`}
            />
            <p className="text-xs text-slate-500 mt-1">
              Restart dev server. Halaman <a href="/admin/peta" className="text-brand-600 underline">/admin/peta</a> dan picker lokasi otomatis pakai Google Maps.
            </p>
          </Step>
          <Step n={3} title="Auto-fallback ke OpenStreetMap">
            <p className="text-sm">
              Kalau API Key tidak diset, kuota habis, atau Google Maps gagal load (mis. user di-blok jaringan), aplikasi otomatis switch ke OpenStreetMap (Leaflet). Tidak perlu konfigurasi tambahan — fitur peta tetap jalan.
            </p>
          </Step>
          <Step n={4} title="Biaya">
            <p className="text-sm">
              Google Maps punya <b>$200 free credit/bulan</b> (~28.000 map loads gratis). Untuk depot air UMKM, hampir pasti tidak akan kena biaya. Set <b>billing alert</b> di Google Cloud Console untuk aman.
            </p>
          </Step>
        </Section>

        <Section id="role" title="Role & Akun">
          <ul className="list-disc pl-5 space-y-1 text-sm">
            <li><b>Admin</b>: full akses (dashboard, semua menu, pengaturan).</li>
            <li><b>Kasir</b>: hanya POS, order management, riwayat transaksi.</li>
            <li><b>Pelanggan</b>: order online, riwayat, profil.</li>
            <li>Tambah staff baru di <a href="/admin/users" className="text-brand-600 underline">/admin/users</a> → <b>Tambah Admin/Kasir</b>.</li>
            <li>Pelanggan daftar sendiri di <code>/register</code>.</li>
          </ul>
        </Section>

        <Section id="backup" title="Backup Database">
          <p className="text-sm">
            Database SQLite ada di file{" "}
            <code className="bg-slate-100 px-1 rounded">./data/depot.db</code>. Backup tinggal copy
            file ini ke lokasi aman secara berkala.
          </p>
          <p className="text-sm mt-2">
            Untuk produksi, pertimbangkan migrasi ke Postgres dengan ubah{" "}
            <code className="bg-slate-100 px-1 rounded">drizzle.config.ts</code> dan{" "}
            <code className="bg-slate-100 px-1 rounded">src/db/index.ts</code>.
          </p>
        </Section>
      </div>
    </div>
  );
}

function Section({
  id,
  title,
  summary,
  children,
}: {
  id: string;
  title: string;
  summary?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="bg-white border border-slate-200 rounded-xl p-5 scroll-mt-4">
      <h2 className="text-lg font-bold text-slate-800">{title}</h2>
      {summary && <p className="text-sm text-slate-500 mb-4">{summary}</p>}
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function Step({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-brand-100 text-brand-700 font-semibold text-sm flex items-center justify-center">
        {n}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-slate-800 mb-1.5">{title}</div>
        {children}
      </div>
    </div>
  );
}
