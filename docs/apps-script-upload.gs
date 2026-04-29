// =====================================================================
// Snippet tambahan untuk Apps Script existing (Sheets sync) — handle
// upload bukti foto kurir ke Google Drive.
//
// Cara pasang:
// 1. Buka Apps Script project yang sudah deploy untuk sheets sync
// 2. Tambahkan kode di bawah ke file Code.gs (atau buat file baru)
// 3. Update fungsi `doPost` existing supaya route op="uploadFile" ke
//    handler ini (lihat bagian "Patch doPost" di bawah).
// 4. Deploy ulang sebagai Web App (Manage deployments → New version)
// 5. Di /admin/pengaturan aplikasi, set value `driveFolderBuktiKurir`
//    dengan ID folder Drive (URL folder = .../folders/<ID>).
//
// =====================================================================

function handleUploadFile_(req) {
  // req: { token, op:"uploadFile", folderId, filename, mimeType, base64 }
  if (!req.folderId) return { ok: false, error: "folderId required" };
  if (!req.base64) return { ok: false, error: "base64 required" };

  var folder = DriveApp.getFolderById(req.folderId);
  var blob = Utilities.newBlob(
    Utilities.base64Decode(req.base64),
    req.mimeType || "image/jpeg",
    req.filename || "upload.jpg"
  );
  var file = folder.createFile(blob);

  // Set sharing supaya bisa diakses lewat link (anyone with link, viewer)
  try {
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } catch (e) {
    // ignore — beberapa workspace tidak izinkan ANYONE
  }

  var fileId = file.getId();
  // URL view langsung gambar (bisa di-<img src=...>). Pakai uc?id= untuk thumbnail-friendly.
  var url = "https://drive.google.com/uc?id=" + fileId;

  return { ok: true, fileId: fileId, url: url };
}

// =====================================================================
// Patch doPost — tambahkan case "uploadFile" di switch existing.
// Contoh struktur lengkap (sesuaikan dengan kode existing kamu):
// =====================================================================

/*
function doPost(e) {
  var req;
  try {
    req = JSON.parse(e.postData.contents);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: "bad json" }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // Token check (existing)
  var TOKEN = PropertiesService.getScriptProperties().getProperty("TOKEN");
  if (req.token !== TOKEN) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: "unauthorized" }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  var resp;
  switch (req.op) {
    case "ping":       resp = { ok: true, msg: "pong" }; break;
    case "ensure":     resp = handleEnsure_(req); break;
    case "append":     resp = handleAppend_(req); break;
    case "replace":    resp = handleReplace_(req); break;
    case "read":       resp = handleRead_(req); break;
    case "uploadFile": resp = handleUploadFile_(req); break;   // ← TAMBAHKAN INI
    default:           resp = { ok: false, error: "unknown op: " + req.op };
  }

  return ContentService.createTextOutput(JSON.stringify(resp))
    .setMimeType(ContentService.MimeType.JSON);
}
*/
