/**
 * ============================================================
 *  DEPOT GNR — Spreadsheet Cadangan (Emergency Mode)
 * ============================================================
 *
 * Apps Script untuk Google Spreadsheet yang dipakai admin saat
 * aplikasi utama (depot.genster.my.id) down.
 *
 * Cara setup: lihat docs/PANDUAN-SPREADSHEET-CADANGAN.md
 *
 * Fungsi:
 *  - Custom menu "DEPOT GNR" di toolbar
 *  - Form sidebar untuk: Tambah Transaksi POS, Order Antar,
 *    Pelanggan Baru
 *  - Cek status server (online/offline)
 *  - Push batch ke aplikasi saat server up lagi
 *  - Pull master data (pelanggan + produk) untuk dropdown
 */

const APP_URL = 'https://depot.genster.my.id';
// SECRET di-set lewat PropertiesService → File → Project properties → Script properties
// Key: SHEET_SYNC_SECRET, Value: <samakan dengan env SHEET_SYNC_SECRET di server>

// Nama sheet
const SHEET_TRX = 'Transaksi_Pending';
const SHEET_ORDER = 'Order_Pending';
const SHEET_PEL = 'Pelanggan_Baru';
const SHEET_LOG = 'Status_Log';
const SHEET_MASTER_PEL = 'Master_Pelanggan';
const SHEET_MASTER_PROD = 'Master_Produk';
const SHEET_DASHBOARD = 'Dashboard';

// ============================================================
// MENU
// ============================================================
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🪣 DEPOT GNR')
    .addItem('📊 Cek Status Server', 'cekStatusServer')
    .addSeparator()
    .addItem('📝 Tambah Transaksi POS', 'openFormTransaksi')
    .addItem('🚚 Tambah Order Antar', 'openFormOrder')
    .addItem('👤 Tambah Pelanggan Baru', 'openFormPelanggan')
    .addSeparator()
    .addItem('🔄 Push Semua Pending ke Server', 'pushSemuaPending')
    .addItem('⬇️ Pull Master Data (Pelanggan + Produk)', 'pullMasterData')
    .addSeparator()
    .addItem('🧰 Setup Awal (Buat Sheet)', 'setupSheets')
    .addItem('🔁 Refresh Dashboard', 'rebuildDashboard')
    .addItem('⚙️ Set API Secret', 'setApiSecret')
    .addToUi();
}

// ============================================================
// SETUP AWAL
// ============================================================
function setupSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheets = [
    { name: SHEET_TRX, headers: ['Timestamp', 'No.Nota', 'Pelanggan', 'Telp', 'Items (JSON)', 'Total', 'Metode Bayar', 'Catatan', 'Status Sync', 'Sync At', 'Error'] },
    { name: SHEET_ORDER, headers: ['Timestamp', 'No.Order', 'Pelanggan', 'Telp', 'Alamat', 'Items (JSON)', 'Total', 'Metode Bayar', 'Status Bayar', 'Catatan', 'Status Sync', 'Sync At', 'Error'] },
    { name: SHEET_PEL, headers: ['Timestamp', 'Nama', 'Telp', 'Alamat', 'Tipe', 'Status Sync', 'Sync At', 'Error'] },
    { name: SHEET_LOG, headers: ['Timestamp', 'Aksi', 'Hasil', 'Detail'] },
    { name: SHEET_MASTER_PEL, headers: ['ID', 'Nama', 'Telp', 'Alamat'] },
    { name: SHEET_MASTER_PROD, headers: ['ID', 'Nama', 'Aktif', 'Harga Isi Ulang', 'Harga Tukar', 'Harga Beli Baru'] },
    { name: SHEET_DASHBOARD, headers: [] },
  ];

  sheets.forEach((cfg) => {
    let sh = ss.getSheetByName(cfg.name);
    if (!sh) sh = ss.insertSheet(cfg.name);
    if (cfg.headers.length > 0) {
      sh.getRange(1, 1, 1, cfg.headers.length).setValues([cfg.headers])
        .setFontWeight('bold').setBackground('#0ea5e9').setFontColor('white');
      sh.setFrozenRows(1);
    }
  });

  // Build Dashboard
  rebuildDashboard(true);

  SpreadsheetApp.getUi().alert(
    '✅ Setup Selesai',
    `${sheets.length} sheet sudah disiapkan.\n\nLangkah berikutnya:\n1. Set API Secret (menu → ⚙️ Set API Secret)\n2. Pull Master Data\n3. Mulai input transaksi`,
    SpreadsheetApp.getUi().ButtonSet.OK,
  );
}

// ============================================================
// DASHBOARD
// ============================================================
// Apps Script `setFormula()` selalu pakai en_US syntax (separator `,`)
// terlepas dari locale spreadsheet — Google translates ke locale user
// saat render. Jangan pakai setFormulaLocal (tidak konsisten di runtime).
function rebuildDashboard(silent) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let dash = ss.getSheetByName(SHEET_DASHBOARD);
  if (!dash) dash = ss.insertSheet(SHEET_DASHBOARD);

  // Pastikan sheet referensi sudah ada — kalau belum, formula akan #REF!
  const required = [SHEET_TRX, SHEET_ORDER, SHEET_PEL];
  for (const name of required) {
    if (!ss.getSheetByName(name)) {
      SpreadsheetApp.getUi().alert(
        `❌ Sheet "${name}" belum ada. Jalankan "🧰 Setup Awal" dulu.`,
      );
      return;
    }
  }

  dash.clear();
  dash.getRange('A1').setValue('🪣 DEPOT GNR — Dashboard Cadangan').setFontSize(18).setFontWeight('bold');
  dash.getRange('A3').setValue('Status Server:').setFontWeight('bold');
  dash.getRange('B3').setValue('Klik menu → "📊 Cek Status Server"');

  dash.getRange('A5').setValue('STATISTIK PENDING SYNC').setFontWeight('bold').setBackground('#fef3c7');
  dash.getRange('A6').setValue('Transaksi pending:');
  dash.getRange('B6').setFormula(`=COUNTIF('${SHEET_TRX}'!I:I,"pending")`);
  dash.getRange('A7').setValue('Order pending:');
  dash.getRange('B7').setFormula(`=COUNTIF('${SHEET_ORDER}'!K:K,"pending")`);
  dash.getRange('A8').setValue('Pelanggan baru pending:');
  dash.getRange('B8').setFormula(`=COUNTIF('${SHEET_PEL}'!F:F,"pending")`);

  dash.getRange('A10').setValue('TOTAL TERSINKRON').setFontWeight('bold').setBackground('#d1fae5');
  dash.getRange('A11').setValue('Transaksi synced:');
  dash.getRange('B11').setFormula(`=COUNTIF('${SHEET_TRX}'!I:I,"synced")`);
  dash.getRange('A12').setValue('Order synced:');
  dash.getRange('B12').setFormula(`=COUNTIF('${SHEET_ORDER}'!K:K,"synced")`);
  dash.getRange('A13').setValue('Pelanggan synced:');
  dash.getRange('B13').setFormula(`=COUNTIF('${SHEET_PEL}'!F:F,"synced")`);

  dash.getRange('A15').setValue('OMZET HARI INI (dari sheet)').setFontWeight('bold').setBackground('#fef3c7');
  dash.getRange('A16').setValue('Total transaksi hari ini:');
  dash.getRange('B16').setFormula(
    `=SUMPRODUCT((INT('${SHEET_TRX}'!A2:A1000)=TODAY())*'${SHEET_TRX}'!F2:F1000)`,
  );
  dash.getRange('B16').setNumberFormat('"Rp"#,##0');
  dash.getRange('A17').setValue('Total order hari ini:');
  dash.getRange('B17').setFormula(
    `=SUMPRODUCT((INT('${SHEET_ORDER}'!A2:A1000)=TODAY())*'${SHEET_ORDER}'!G2:G1000)`,
  );
  dash.getRange('B17').setNumberFormat('"Rp"#,##0');

  dash.getRange('A19').setValue('TERAKHIR DIPERBARUI').setFontWeight('bold').setBackground('#e0e7ff');
  dash.getRange('A20').setValue('Refresh terakhir:');
  dash.getRange('B20').setValue(new Date()).setNumberFormat('dd/MM/yyyy HH:mm:ss');

  dash.getRange('A:A').setFontWeight('bold');
  dash.setColumnWidth(1, 240);
  dash.setColumnWidth(2, 220);

  SpreadsheetApp.flush();

  if (!silent) {
    SpreadsheetApp.getUi().alert('✅ Dashboard diperbarui.');
  }
}

function setApiSecret() {
  const ui = SpreadsheetApp.getUi();
  const resp = ui.prompt(
    'Set API Secret',
    'Masukkan SHEET_SYNC_SECRET (sama dengan env di server):',
    ui.ButtonSet.OK_CANCEL,
  );
  if (resp.getSelectedButton() !== ui.Button.OK) return;
  const secret = resp.getResponseText().trim();
  if (!secret) {
    ui.alert('Kosong, batal disimpan.');
    return;
  }
  PropertiesService.getScriptProperties().setProperty('SHEET_SYNC_SECRET', secret);
  ui.alert('✅ Secret tersimpan.');
}

function getSecret() {
  return PropertiesService.getScriptProperties().getProperty('SHEET_SYNC_SECRET');
}

// ============================================================
// STATUS SERVER
// ============================================================
function cekStatusServer() {
  const ui = SpreadsheetApp.getUi();
  try {
    const r = UrlFetchApp.fetch(`${APP_URL}/api/health`, { muteHttpExceptions: true });
    const code = r.getResponseCode();
    const body = JSON.parse(r.getContentText());
    if (code === 200 && body.status === 'ok') {
      ui.alert('🟢 Server ONLINE', `DB: ${body.db}\nUptime: ${Math.round(body.uptime / 60)} menit\nResponse: ${body.responseMs}ms\n\nAman untuk push pending.`, ui.ButtonSet.OK);
      logEvent('cekStatus', 'online', JSON.stringify(body));
    } else {
      ui.alert('🔴 Server BERMASALAH', `Code: ${code}\nStatus: ${body.status}\n\nGunakan spreadsheet untuk input sementara.`, ui.ButtonSet.OK);
      logEvent('cekStatus', 'down', `code=${code}`);
    }
  } catch (e) {
    ui.alert('🔴 Server OFFLINE', `Tidak bisa kontak server.\nError: ${e.message}\n\nInput langsung ke spreadsheet, push nanti saat server up.`, ui.ButtonSet.OK);
    logEvent('cekStatus', 'offline', e.message);
  }
}

// ============================================================
// FORM SIDEBAR
// ============================================================
function openFormTransaksi() {
  const html = HtmlService.createHtmlOutputFromFile('FormTransaksi')
    .setTitle('📝 Tambah Transaksi POS')
    .setWidth(420);
  SpreadsheetApp.getUi().showSidebar(html);
}

function openFormOrder() {
  const html = HtmlService.createHtmlOutputFromFile('FormOrder')
    .setTitle('🚚 Tambah Order Antar')
    .setWidth(420);
  SpreadsheetApp.getUi().showSidebar(html);
}

function openFormPelanggan() {
  const html = HtmlService.createHtmlOutputFromFile('FormPelanggan')
    .setTitle('👤 Tambah Pelanggan')
    .setWidth(380);
  SpreadsheetApp.getUi().showSidebar(html);
}

// Data untuk dropdown form (dipanggil dari client HTML)
function getMasterData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const pelSheet = ss.getSheetByName(SHEET_MASTER_PEL);
  const prodSheet = ss.getSheetByName(SHEET_MASTER_PROD);
  const pelRows = pelSheet.getDataRange().getValues().slice(1);
  const prodRows = prodSheet.getDataRange().getValues().slice(1);
  return {
    pelanggan: pelRows
      .filter((r) => r[1])
      .map((r) => ({ id: r[0], nama: r[1], telp: r[2], alamat: r[3] })),
    produk: prodRows
      .filter((r) => r[1] && r[2])
      .map((r) => ({
        id: r[0],
        nama: r[1],
        aktif: r[2],
        hargaIsiUlang: r[3],
        hargaTukar: r[4],
        hargaBeliBaru: r[5],
      })),
  };
}

// ============================================================
// SAVE DARI FORM
// ============================================================
function saveTransaksi(payload) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(SHEET_TRX);
  const ts = new Date();
  const nomorNota = payload.nomorNota || generateNomorNota('NOTA');
  const total = payload.items.reduce((s, it) => s + it.hargaSatuan * it.qty, 0);
  sh.appendRow([
    ts,
    nomorNota,
    payload.pelangganNama || '',
    payload.pelangganTelp || '',
    JSON.stringify(payload.items),
    total,
    payload.metodeBayar,
    payload.catatan || '',
    'pending',
    '',
    '',
  ]);
  return { ok: true, nomorNota, total };
}

function saveOrder(payload) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(SHEET_ORDER);
  const ts = new Date();
  const nomorOrder = payload.nomorOrder || generateNomorNota('ORD');
  const total = payload.items.reduce((s, it) => s + it.hargaSatuan * it.qty, 0);
  sh.appendRow([
    ts,
    nomorOrder,
    payload.pelangganNama || '',
    payload.pelangganTelp || '',
    payload.alamatAntar || '',
    JSON.stringify(payload.items),
    total,
    payload.metodeBayar || '',
    payload.statusBayar || 'belum',
    payload.catatan || '',
    'pending',
    '',
    '',
  ]);
  return { ok: true, nomorOrder, total };
}

function savePelanggan(payload) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(SHEET_PEL);
  const ts = new Date();
  sh.appendRow([
    ts,
    payload.nama,
    payload.telp || '',
    payload.alamat || '',
    payload.tipe || 'umum',
    'pending',
    '',
    '',
  ]);
  return { ok: true };
}

// ============================================================
// PUSH KE SERVER
// ============================================================
function pushSemuaPending() {
  const secret = getSecret();
  if (!secret) {
    SpreadsheetApp.getUi().alert('❌ Set API Secret dulu (menu → ⚙️ Set API Secret)');
    return;
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const trxSheet = ss.getSheetByName(SHEET_TRX);
  const ordSheet = ss.getSheetByName(SHEET_ORDER);
  const pelSheet = ss.getSheetByName(SHEET_PEL);

  const trxRows = trxSheet.getDataRange().getValues();
  const ordRows = ordSheet.getDataRange().getValues();
  const pelRows = pelSheet.getDataRange().getValues();

  const transaksi = [];
  const transaksiRowIdx = [];
  for (let i = 1; i < trxRows.length; i++) {
    if (trxRows[i][8] === 'pending') {
      try {
        transaksi.push({
          nomorNota: trxRows[i][1],
          pelangganNama: trxRows[i][2],
          pelangganTelp: trxRows[i][3],
          items: JSON.parse(trxRows[i][4] || '[]'),
          metodeBayar: trxRows[i][6] || 'cash',
          catatan: trxRows[i][7],
          createdAt: new Date(trxRows[i][0]).toISOString(),
        });
        transaksiRowIdx.push(i + 1);
      } catch (e) {
        // skip row dengan items invalid
      }
    }
  }

  const orderAntar = [];
  const orderRowIdx = [];
  for (let i = 1; i < ordRows.length; i++) {
    if (ordRows[i][10] === 'pending') {
      try {
        orderAntar.push({
          nomorOrder: ordRows[i][1],
          pelangganNama: ordRows[i][2],
          pelangganTelp: ordRows[i][3],
          alamatAntar: ordRows[i][4],
          items: JSON.parse(ordRows[i][5] || '[]'),
          metodeBayar: ordRows[i][7] || undefined,
          statusBayar: ordRows[i][8] || 'belum',
          catatan: ordRows[i][9],
          createdAt: new Date(ordRows[i][0]).toISOString(),
        });
        orderRowIdx.push(i + 1);
      } catch (e) {
        // skip
      }
    }
  }

  const pelangganBaru = [];
  const pelRowIdx = [];
  for (let i = 1; i < pelRows.length; i++) {
    if (pelRows[i][5] === 'pending') {
      pelangganBaru.push({
        nama: pelRows[i][1],
        telp: pelRows[i][2],
        alamat: pelRows[i][3],
        tipe: pelRows[i][4] || 'umum',
      });
      pelRowIdx.push(i + 1);
    }
  }

  if (transaksi.length === 0 && orderAntar.length === 0 && pelangganBaru.length === 0) {
    SpreadsheetApp.getUi().alert('Tidak ada data pending untuk di-sync.');
    return;
  }

  const payload = { transaksi, orderAntar, pelangganBaru };

  try {
    const r = UrlFetchApp.fetch(`${APP_URL}/api/sync/from-sheet`, {
      method: 'post',
      contentType: 'application/json',
      headers: { 'X-Sheet-Sync-Secret': secret },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
    });
    const code = r.getResponseCode();
    const body = JSON.parse(r.getContentText());

    if (code !== 200) {
      SpreadsheetApp.getUi().alert(`❌ Sync gagal (HTTP ${code})\n${body.error || 'unknown'}`);
      logEvent('push', 'error', JSON.stringify(body));
      return;
    }

    const now = new Date();

    // Update status per item — map result by ref ke baris
    body.details.pelangganBaru.forEach((res, idx) => {
      const rowIdx = pelRowIdx[idx];
      if (rowIdx) {
        pelSheet.getRange(rowIdx, 6).setValue(res.status);
        pelSheet.getRange(rowIdx, 7).setValue(now);
        pelSheet.getRange(rowIdx, 8).setValue(res.reason || '');
      }
    });
    body.details.transaksi.forEach((res, idx) => {
      const rowIdx = transaksiRowIdx[idx];
      if (rowIdx) {
        trxSheet.getRange(rowIdx, 9).setValue(res.status);
        trxSheet.getRange(rowIdx, 10).setValue(now);
        trxSheet.getRange(rowIdx, 11).setValue(res.reason || '');
      }
    });
    body.details.orderAntar.forEach((res, idx) => {
      const rowIdx = orderRowIdx[idx];
      if (rowIdx) {
        ordSheet.getRange(rowIdx, 11).setValue(res.status);
        ordSheet.getRange(rowIdx, 12).setValue(now);
        ordSheet.getRange(rowIdx, 13).setValue(res.reason || '');
      }
    });

    const sum = body.summary;
    SpreadsheetApp.getUi().alert(
      '✅ Sync Selesai',
      `Transaksi: ${sum.transaksi.synced} synced, ${sum.transaksi.skipped} duplikat, ${sum.transaksi.error} error\n` +
        `Order: ${sum.orderAntar.synced} synced, ${sum.orderAntar.skipped} duplikat, ${sum.orderAntar.error} error\n` +
        `Pelanggan: ${sum.pelangganBaru.synced} synced, ${sum.pelangganBaru.skipped} duplikat, ${sum.pelangganBaru.error} error`,
      SpreadsheetApp.getUi().ButtonSet.OK,
    );
    logEvent('push', 'ok', JSON.stringify(sum));
  } catch (e) {
    SpreadsheetApp.getUi().alert(`❌ Tidak bisa kontak server: ${e.message}`);
    logEvent('push', 'fail', e.message);
  }
}

// ============================================================
// PULL MASTER DATA
// ============================================================
function pullMasterData() {
  const secret = getSecret();
  if (!secret) {
    SpreadsheetApp.getUi().alert('❌ Set API Secret dulu');
    return;
  }
  try {
    const r = UrlFetchApp.fetch(`${APP_URL}/api/sync/from-sheet`, {
      method: 'get',
      headers: { 'X-Sheet-Sync-Secret': secret },
      muteHttpExceptions: true,
    });
    const code = r.getResponseCode();
    const body = JSON.parse(r.getContentText());
    if (code !== 200) {
      SpreadsheetApp.getUi().alert(`Gagal: HTTP ${code} — ${body.error}`);
      return;
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const pelSheet = ss.getSheetByName(SHEET_MASTER_PEL);
    pelSheet.clearContents();
    pelSheet.appendRow(['ID', 'Nama', 'Telp', 'Alamat']);
    if (body.pelanggan.length > 0) {
      const rows = body.pelanggan.map((p) => [p.id, p.nama, p.telp || '', p.alamat || '']);
      pelSheet.getRange(2, 1, rows.length, 4).setValues(rows);
    }

    const prodSheet = ss.getSheetByName(SHEET_MASTER_PROD);
    prodSheet.clearContents();
    prodSheet.appendRow(['ID', 'Nama', 'Aktif', 'Harga Isi Ulang', 'Harga Tukar', 'Harga Beli Baru']);
    if (body.produk.length > 0) {
      const rows = body.produk.map((p) => [p.id, p.nama, p.aktif, p.hargaIsiUlang, p.hargaTukar, p.hargaBeliBaru]);
      prodSheet.getRange(2, 1, rows.length, 6).setValues(rows);
    }

    SpreadsheetApp.getUi().alert(`✅ Master data ter-update: ${body.pelanggan.length} pelanggan, ${body.produk.length} produk`);
    logEvent('pull', 'ok', `pel=${body.pelanggan.length} prod=${body.produk.length}`);
  } catch (e) {
    SpreadsheetApp.getUi().alert(`Gagal kontak server: ${e.message}`);
    logEvent('pull', 'fail', e.message);
  }
}

// ============================================================
// HELPERS
// ============================================================
function generateNomorNota(prefix) {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const rand = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
  return `${prefix}-${ymd}-${rand}`;
}

function logEvent(aksi, hasil, detail) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(SHEET_LOG);
  if (!sh) return;
  sh.appendRow([new Date(), aksi, hasil, detail]);
}
