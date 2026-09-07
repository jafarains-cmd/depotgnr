# PRD — Depot Air Multi-Tenant SaaS

**Status:** DRAFT · **Owner:** jafarains@gmail.com · **Terakhir update:** 2026-09-01

## 1. Executive Summary

Transform Depot Air Minum GNR dari aplikasi single-tenant (1 depot per install) menjadi **multi-tenant SaaS**, di mana banyak depot pakai 1 instance server bersama dengan data yang terisolasi total. Target: enable Anda jual/lisensi aplikasi ke depot lain tanpa deploy VM baru untuk setiap depot.

**Key trade-off vs Opsi 1 (instance per depot):**
- + Operasional lebih ringan pada skala 10+ depot (satu server bersama, satu deploy)
- + Update fitur langsung nikmati semua tenant (no per-instance migration)
- − Risk data leak antar tenant kalau ada bug filter query (butuh disiplin ketat)
- − Refactor besar (~40 tabel, ~200 query touch)
- − Single point of failure (kalau server down, semua depot down)

## 2. Goals & Non-Goals

### Goals

1. Satu instance Next.js + SQLite (atau Postgres) melayani N depot
2. Data setiap depot terisolasi absolut — tenant A tidak bisa lihat/query data tenant B
3. Setiap depot punya subdomain sendiri (mis. `depot-a.gnr.app`, `depot-b.gnr.app`)
4. Self-service onboarding (calon depot signup → provision otomatis → siap pakai <10 menit)
5. Setiap depot manage sendiri: staff, produk, pelanggan, konfigurasi WA, FCM, Drive
6. Anda (super admin) punya dashboard lihat health semua tenant + billing status
7. Model bisnis subscription bulanan (mis. Rp 200-500rb/bulan per depot)

### Non-Goals (out of scope untuk MVP)

- Cross-tenant reporting (mis. "top depot by revenue nasional")
- Multi-region deployment (asumsi Asia Tenggara saja)
- Migrating single-tenant deployment kekurang mau menjadi tenant di SaaS (data existing tetap di old instance, tidak auto-migrated)
- White-label penuh (custom branding per tenant) — deferred ke v2

## 3. Personas

| Persona | Deskripsi | Journey |
|---------|-----------|---------|
| **Super Admin (Anda)** | Owner platform. Kelola tenant, billing, infra. | Login `/super/dashboard`, lihat metrics semua tenant, suspend tenant yang tidak bayar |
| **Tenant Admin** | Owner/manager 1 depot. | Signup → auto-provision → onboarding setup produk/harga/staff → normal admin flow |
| **Tenant Staff** (kasir/kurir) | Karyawan 1 depot. | Login di subdomain depotnya → akses fitur kasir/kurir seperti sekarang |
| **Pelanggan** | End user 1 depot. | Register di subdomain depot mereka → order galon → tracking → normal flow |

## 4. Multi-Tenancy Model — Shared DB with tenant_id (recommended)

**Alternatif dipertimbangkan:**

| Model | Pros | Cons | Recommended? |
|-------|------|------|--------------|
| **Shared DB + tenant_id column** | Simple deploy, cheap infra, easy cross-tenant super-admin queries | Risk bug tenant leak, backup restore per tenant complex | ✅ **YES** untuk MVP |
| DB-per-tenant (schema atau file) | Data isolation absolut, per-tenant backup mudah | 30+ SQLite files, migration N kali, connection pool complex | ❌ tunggu v2 |
| Multi-cluster (K8s namespace) | Ultimate isolation, scale independent | Ops overhead tinggi, biaya cluster besar | ❌ overkill untuk 5-50 depot |

**Pilihan MVP:** Shared SQLite (atau upgrade ke Postgres kalau butuh concurrent writes tinggi) dengan `tenant_id` di setiap tabel operasional.

## 5. Data Model Changes

### Tables yang perlu `tenant_id`

Semua tabel operasional depot (~35 tabel). Contoh:

- `pelanggan`, `produk`, `orderHeader`, `orderItem`, `transaksi`, `transaksiItem`
- `pengaturan` (per-tenant config), `bonus`, `mutasiLoyalti`, `komplain`
- `galonDipinjam`, `mutasiGalonPinjam`, `galonPelanggan`
- `shift`, `bahanBaku`, `inventory`, `pembelian`
- `pushSubscription`, `fcmToken`, `lokasiKurir`
- `notaGabungan`, `audit`, `backup`, `loginEvent`

### Tables yang TIDAK butuh `tenant_id`

- `user` (Better Auth) — user global, mapping ke tenant via `tenantMember` table
- `session` (Better Auth) — global
- `verification`, `account` (Better Auth) — global

### Tabel baru

```
tenants
  id (uuid), slug (unique, subdomain), namaDepot,
  status (active | suspended | trial | expired),
  paketId, expiredAt, createdAt

tenant_members
  id, tenantId, userId, role (admin | kasir | kurir | pelanggan),
  invitedAt, joinedAt

tenant_paket
  id, nama (basic | pro | enterprise), hargaBulanan,
  maksStaff, maksPelanggan, maksTransaksiBulanan, fitur (JSON: WA, FCM, print)

tenant_billing
  id, tenantId, bulan, status (paid | pending | overdue),
  amount, paidAt, invoiceUrl
```

### Query patterns yang harus diubah

**Sebelum:**
```typescript
const orders = await db.select().from(orderHeader).where(eq(orderHeader.status, "pending"))
```

**Sesudah:**
```typescript
const orders = await db.select().from(orderHeader).where(
  and(eq(orderHeader.status, "pending"), eq(orderHeader.tenantId, ctx.tenantId))
)
```

Ada ~200 query yang harus di-audit. Solusi: **wrapper Drizzle** dengan auto-scoped tenantId (mirip Prisma's row-level security bypass helper). Menghindari lupa scope manual di query baru.

## 6. Tenant Resolution

### Subdomain routing (recommended)

- `depot-tirtaputra.gnr.app` → tenantId = "depot-tirtaputra"
- `depot-airjaya.gnr.app` → tenantId = "depot-airjaya"
- `admin.gnr.app` → super admin (Anda)
- `gnr.app` → landing page + signup

**Implementation:**
- Next.js middleware baca `req.headers.host` → extract subdomain → resolve ke tenantId via `tenants` table (cache 5 min)
- Set tenantId di request context (via async local storage atau Next.js unstable_after)
- Semua page/API baca dari context

### Wildcard DNS + Cloudflare Tunnel

- `*.gnr.app` → 1 Cloudflare Tunnel → LXC server Next.js
- Signup baru → generate subdomain → auto add via Cloudflare API (atau template A record wildcard)

### Alternatif: path-based routing

`gnr.app/t/depot-tirtaputra/admin/...` — lebih murah setup, tapi tampak kurang professional dari sisi tenant.

## 7. Authentication & Authorization

### Auth flow

1. User signup di `depot-x.gnr.app/register` → create user (global) + `tenantMember` (linked to depot-x)
2. User login di `depot-x.gnr.app/login` → session check + verify user is member of tenant "depot-x"
3. Kalau user pindah antar depot (rare, mostly for Anda sebagai super admin) → cross-tenant login via `admin.gnr.app`

### Role model

```
Super admin (Anda)
  → akses admin.gnr.app + semua tenant (read + write)

Tenant admin
  → akses tenantnya sendiri + role "admin"
  → invite staff, config, semua data tenant

Tenant staff (kasir/kurir)
  → akses tenantnya + role scoped

Pelanggan
  → akses tenantnya + role "pelanggan"
```

### Better Auth integration

- Extend Better Auth session dengan `tenantId` claim
- Add middleware guard `requireTenantMember(tenantId, role)`

## 8. Infrastructure

### Server

**Phase 1 (1-20 tenants):**
- 1 LXC/VPS, 4-8GB RAM, 40GB disk
- Next.js standalone + SQLite (WAL mode)
- Nginx reverse proxy + Cloudflare Tunnel wildcard
- Systemd service

**Phase 2 (20-100 tenants):**
- Upgrade SQLite → PostgreSQL (better concurrent write)
- Optional: pisah service (API + workers)
- Backup harian ke S3-compatible storage

**Phase 3 (100+ tenants):**
- Multi-node deploy, Redis session store, PostgreSQL read replicas

### Storage per tenant

**Uploads (KTP, bukti bayar, bukti antar, QRIS):**
- Google Drive per tenant (mereka connect Drive mereka sendiri via OAuth)
- Atau S3 bucket per tenant (managed by platform)

**Decision:** untuk MVP, **Drive per tenant** — tenant admin input Drive folder IDs mereka di `pengaturan`. Ownership data tetap di tangan tenant.

## 9. External Integrations per Tenant

### WhatsApp API (Fonnte / Wablas)

- Setiap depot punya nomor WA + API key mereka sendiri
- Config di per-tenant `pengaturan`: `WHATSAPP_API_KEY_TENANT_X`, `WHATSAPP_API_URL_TENANT_X`
- Fonnte device 1:1 dengan depot (mereka bayar Fonnte sendiri Rp 50-100rb/bulan)

### Firebase FCM

**Option A:** Share 1 Firebase project (Anda pakai untuk semua tenant)
- Simple, 1 config
- Tapi FCM topic/token bisa cross-tenant leak kalau device di-share (rare tapi risky)

**Option B:** Firebase project per tenant
- Tenant admin bikin Firebase project sendiri → paste `google-services.json` + service account ke pengaturan tenant
- Isolated, tapi setup effort tinggi untuk tenant

**Recommended:** Option A dengan **topic scoping** — subscribe FCM topic per tenant (mis. `tenant-depot-x`), notif kirim ke topic bukan direct token. Isolation cukup untuk MVP.

### Google Apps Script (Drive upload)

Sama dengan WA — tenant admin deploy Apps Script mereka sendiri, paste URL + token ke pengaturan tenant.

## 10. Onboarding Flow

### Self-service signup

1. Calon depot buka `gnr.app` → tap **"Daftar Depot Baru"**
2. Form: nama depot, subdomain (validasi unique + regex `[a-z0-9-]+`), nama owner, email, no WA
3. Pilih paket (Basic Rp 200rb/bulan atau Pro Rp 500rb/bulan)
4. Auto-provision:
   - Insert row di `tenants` (status=`trial`, expiredAt=now+30 hari)
   - Create user Better Auth (email/password)
   - Insert `tenantMember` role=admin
   - Seed default data: produk template (Galon Isi Ulang, Galon Tukar), pengaturan template
5. Redirect ke `depot-x.gnr.app/admin/onboarding-wizard`:
   - Setup nama depot lengkap, alamat, telp
   - Tambah produk sesuai bisnis mereka
   - Invite staff (kasir/kurir)
   - Setup Fonnte (opsional)
   - Setup Drive folder (opsional)
6. 30 hari trial → billing reminder → convert to paid (via Xendit) atau suspend

### Manual provisioning (fallback)

Untuk depot yang butuh personal support / enterprise → Anda manual create via `/super/tenants/new`.

## 11. Billing Model

### Paket

| Paket | Harga/bulan | Batas Staff | Batas Pelanggan | Batas Transaksi/bulan | Fitur |
|-------|-------------|-------------|-----------------|-----------------------|-------|
| **Trial** | Rp 0 (30 hari) | 3 | 100 | 500 | Full |
| **Basic** | Rp 199k | 5 | 500 | 2000 | Full kecuali FCM push, background tracking |
| **Pro** | Rp 499k | 15 | Unlimited | Unlimited | Full |
| **Enterprise** | Custom | Custom | Custom | Custom | Full + SLA + custom domain |

### Payment gateway

- Xendit (invoice link bulanan) atau Midtrans
- Kalau tenant tidak bayar 7 hari setelah due date → auto suspend (block login, tapi data preserved)
- 30 hari overdue → hard suspend + notif ke owner (data masih ada, bisa restore kalau bayar)
- 90 hari overdue → data archived (export ke ZIP di S3, delete dari DB)

## 12. Migration Strategy dari Single-Tenant

Existing single-tenant instance (depot.genster.my.id) **tidak auto-migrate** ke SaaS. Opsi:

**A.** Anda jadikan tenant #0 di SaaS baru (rebrand subdomain jadi `depot-gnr.gnr.app`, redirect old domain), export-import data lama.

**B.** Anda tetap jalankan single-tenant instance untuk depot Anda sendiri, SaaS baru untuk depot pihak ketiga.

**Recommended:** Opsi B untuk 6 bulan pertama (uji SaaS di depot lain dulu, depot Anda tidak jadi guinea pig risky migrasi), lalu evaluasi.

## 13. Rollout Phases

### Phase 0 — Foundation (~2 minggu, non-user-facing)

- Add `tenant_id` ke 35+ tabel + migration
- Wrapper Drizzle dengan auto-scoping
- Middleware tenant resolver (subdomain → tenantId)
- Better Auth extend dengan tenantId claim
- Super admin auth (Anda) + basic dashboard `/super/tenants`

### Phase 1 — MVP internal (~2 minggu)

- Signup form + auto-provision flow
- Onboarding wizard tenant admin
- Data isolation audit (semua page/API test dengan 2 tenant dummy)
- Test tenant leak dengan playwright: buat order di tenant A, verify tidak bisa di-akses via tenant B
- Deploy ke staging subdomain (`test-x.gnr.app`, `test-y.gnr.app`)

### Phase 2 — MVP dengan billing (~1 minggu)

- Xendit integration untuk invoice + webhook payment
- Auto suspend/restore based on billing status
- Email + WA notif billing (H-3, due, H+3, H+7)
- Super admin: force-suspend, extend trial, refund

### Phase 3 — External integrations per-tenant (~1 minggu)

- Tenant pengaturan: WA key, Drive folder, FCM topic
- Semua sender code baca config dari tenant context (bukan process.env global)

### Phase 4 — Beta launch (2-4 minggu)

- 3-5 depot beta (yang Anda kenal personally, discount 50%)
- Weekly bug bash + feedback
- Monitor metrics: signup conversion, feature usage, error rate per tenant
- Iterate

### Phase 5 — Public launch

- Landing page marketing
- Content: video demo, testimonial dari beta depot
- Referral program (depot A refer depot B → A dapat 1 bulan gratis)

## 14. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| **Bug tenant leak** (query lupa scope tenantId) | CRITICAL — data 1 depot ke depot lain | Wrapper Drizzle auto-scope + integration test dengan 2 tenant setup, playwright audit setiap PR |
| SQLite bottleneck di 30+ tenant concurrent | HIGH — server slow / crash | Migrate ke Postgres di Phase 2, monitor query time |
| 1 server down = semua tenant down | HIGH — reputasi platform rusak | Uptime monitor + auto-restart, backup harian ke S3, dokumentasi disaster recovery |
| Tenant tidak bayar tapi tetap pakai | MEDIUM — revenue leak | Auto-suspend after 7 hari, hard suspend after 30 |
| Complexity tinggi = slow feature delivery | MEDIUM — kompetitor lebih cepat | Prioritize refactor sekali di awal, jangan setengah-setengah |
| Tenant complain data mereka bocor (bahkan kalau tidak beneran) | HIGH — kepercayaan hilang | Audit log per-tenant, security review external, incident response plan |

## 15. Effort Estimate

Total dari zero → Public launch: **8-12 minggu** kerja fokus.

| Phase | Effort | Milestone |
|-------|--------|-----------|
| Phase 0 (foundation) | 2 minggu | Refactor DB + query wrapper + tenant resolver |
| Phase 1 (MVP internal) | 2 minggu | Signup flow + onboarding + isolation audit |
| Phase 2 (billing) | 1 minggu | Xendit + suspend logic |
| Phase 3 (integrations) | 1 minggu | Per-tenant WA/FCM/Drive |
| Phase 4 (beta) | 2-4 minggu | Beta launch + iterate |
| Phase 5 (public) | 1-2 minggu | Marketing + launch |

## 16. Open Questions

1. **Domain:** register `gnr.app` (~USD 20/tahun) atau pakai subdomain existing (`saas.genster.my.id`)?
2. **Database:** stick SQLite (simpler, cukup untuk <30 tenant) atau langsung Postgres (siap untuk skala 100+)?
3. **Anda pengelola solo atau ada partner?** Kalau solo, prioritaskan features yang mengurangi support beban (self-service, docs bagus, in-app FAQ).
4. **Depot yang paling siap jadi beta tester?** Idealnya 3-5 depot yang: (a) kenal personal, (b) siap kasih feedback jujur, (c) tidak masalah kalau ada bug awal.
5. **Kompetitor lain?** Kalau ada aplikasi depot air lain di Indonesia, benchmark harga + fitur mereka untuk positioning.
6. **APK strategy:** 1 APK generic yang input server URL saat login (paling scalable), atau 1 APK per tenant custom (branding tapi ops berat)?

## 17. Decision Log

Isi setiap kali ambil keputusan penting yang mengubah scope PRD ini:

- **YYYY-MM-DD** — [siapa] memutuskan [apa] karena [alasan]. Impact: [dampak ke plan]
