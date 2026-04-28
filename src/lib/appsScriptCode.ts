/**
 * Kode Apps Script untuk Sheets bridge — di-render di halaman bantuan
 * supaya admin bisa copy-paste. Kalau ada perubahan, edit di sini saja.
 */
export const APPS_SCRIPT_CODE = `const TOKEN = "GANTI_DENGAN_TOKEN_RAHASIA_MIN_24_KARAKTER";

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
      case "ping":     return jsonOut({ ok: true, msg: "pong" });
      case "ensure":   return jsonOut(opEnsure());
      case "append":   return jsonOut(opAppend(body.tab, body.values));
      case "replace":  return jsonOut(opReplace(body.tab, body.rows));
      case "read":     return jsonOut(opRead(body.tab));
      default:         return jsonOut({ ok: false, error: "Unknown op: " + body.op });
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
`;
