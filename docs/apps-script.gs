/**
 * Depot Air Minum — Sheets Bridge + Drive Upload (Google Apps Script)
 *
 * Versi: 2 (2026-04-29) — tambah handler upload bukti foto kurir ke Drive.
 *
 * CARA PASANG (pertama kali):
 * 1. Buka Google Sheet kamu → menu Extensions → Apps Script
 * 2. Hapus seluruh isi default → paste seluruh kode ini
 * 3. Ganti nilai TOKEN di bawah dengan kalimat acak.
 *    Token yang sama harus diisi di /admin/pengaturan aplikasi Depot Air.
 * 4. Save (Ctrl+S) → Deploy → New deployment → Web app.
 *    Execute as: Me. Who has access: Anyone. Deploy.
 * 5. Salin "Web app URL" + token → paste ke /admin/pengaturan.
 *
 * CARA UPDATE (jika sudah pasang versi lama):
 * 1. Hapus isi Code.gs lama → paste seluruh isi file ini.
 * 2. Save → Deploy → Manage deployments → ✏️ edit existing → New version → Deploy.
 * 3. URL & token TIDAK berubah, tidak perlu update di /admin/pengaturan.
 *
 * SETUP TAMBAHAN UNTUK UPLOAD BUKTI KURIR:
 * - Buat folder di Google Drive (mis: "Depot - Bukti Pengantaran")
 * - Salin ID folder dari URL: drive.google.com/drive/folders/<ID>
 * - Di /admin/pengaturan, set field `driveFolderBuktiKurir` dengan ID itu.
 */

const TOKEN = "depotair-7f3kL9MqRz8BvYxNc4HsPwT2";

const HEADERS = {
  Transaksi: ["id", "nomor_nota", "kasir_user_id", "pelanggan_id", "subtotal", "diskon", "total", "metode_bayar", "status", "catatan", "created_at"],
  Order: ["id", "nomor_order", "pelanggan_id", "sumber", "alamat_antar", "status", "total_estimasi", "catatan", "created_at", "updated_at"],
  Produk: ["id", "nama", "deskripsi", "harga_isi_ulang", "harga_tukar", "harga_beli_baru", "aktif"],
};

function doGet(e) {
  return jsonOut({ ok: true, message: "Depot Air Bridge aktif. Pakai POST untuk operasi." });
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    if (body.token !== TOKEN) return jsonOut({ ok: false, error: "Unauthorized: token salah" });
    switch (body.op) {
      case "ping":       return jsonOut({ ok: true, msg: "pong" });
      case "ensure":     return jsonOut(opEnsure());
      case "append":     return jsonOut(opAppend(body.tab, body.values));
      case "replace":    return jsonOut(opReplace(body.tab, body.rows));
      case "read":       return jsonOut(opRead(body.tab));
      case "uploadFile": return jsonOut(opUploadFile(body));
      default:           return jsonOut({ ok: false, error: "Unknown op: " + body.op });
    }
  } catch (err) {
    return jsonOut({ ok: false, error: String(err) });
  }
}

function jsonOut(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function opEnsure() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(HEADERS).forEach(function (name) {
    let sheet = ss.getSheetByName(name);
    if (!sheet) sheet = ss.insertSheet(name);
    const headers = HEADERS[name];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");
    sheet.setFrozenRows(1);
  });
  return { ok: true, msg: "Tab Transaksi/Order/Produk siap." };
}

function opAppend(tab, values) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(tab);
  if (!sheet) sheet = ss.insertSheet(tab);
  sheet.appendRow(values);
  return { ok: true };
}

function opReplace(tab, rows) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(tab);
  if (!sheet) sheet = ss.insertSheet(tab);
  const colCount = HEADERS[tab] ? HEADERS[tab].length : sheet.getLastColumn();
  if (sheet.getLastRow() > 1) {
    sheet.getRange(2, 1, sheet.getLastRow() - 1, colCount).clearContent();
  }
  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
  }
  return { ok: true, count: rows.length };
}

function opRead(tab) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(tab);
  if (!sheet) return { ok: false, error: "Tab " + tab + " tidak ada" };
  const last = sheet.getLastRow();
  if (last < 2) return { ok: true, rows: [] };
  const colCount = HEADERS[tab] ? HEADERS[tab].length : sheet.getLastColumn();
  const data = sheet.getRange(2, 1, last - 1, colCount).getValues();
  return { ok: true, rows: data };
}

/**
 * Upload file (foto bukti pengantaran kurir) ke folder Drive.
 * Body: { token, op:"uploadFile", folderId, filename, mimeType, base64 }
 */
function opUploadFile(body) {
  if (!body.folderId) return { ok: false, error: "folderId required" };
  if (!body.base64)   return { ok: false, error: "base64 required" };

  const folder = DriveApp.getFolderById(body.folderId);
  const blob = Utilities.newBlob(
    Utilities.base64Decode(body.base64),
    body.mimeType || "image/jpeg",
    body.filename || "upload.jpg"
  );
  const file = folder.createFile(blob);

  // Set sharing: anyone with link can view (supaya bisa di-<img> dari aplikasi)
  try {
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } catch (e) {
    // Sebagian Google Workspace blokir ANYONE — abaikan, link tetap valid untuk org member
  }

  const fileId = file.getId();
  return {
    ok: true,
    fileId: fileId,
    url: "https://drive.google.com/uc?id=" + fileId
  };
}
