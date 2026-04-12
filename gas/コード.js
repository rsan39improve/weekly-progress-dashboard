/**
 * weekly-progress-dashboard — Google Apps Script
 *
 * このファイルの内容を Google スプレッドシートの
 * 「拡張機能 > Apps Script」にそのまま貼り付けて使う。
 *
 * ▼ シートの列構成（1行目がヘッダー、2行目以降がデータ）
 * A: 報告日              例: 2026/04/07
 * B: 担当者名            例: 田中
 * C: 事業全体ステータス  例: 順調 / 停滞 / 危険
 * D: 今週の作業ステータス 例: 順調 / 停滞 / 危険
 * E: 今週達成したタスク  例: デザインカンプの修正対応が完了
 * F: 課題・リスク        例: 納期まで2週間だがコーディング未着手
 * G: 来週のタスク        例: コーディング着手・外注先MTG設定
 * H: その他              例: 予算追加申請が必要になるかも
 */

// ── データ取得（Node.js fetch-sheets.js が呼び出す） ─────────────
function doGet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheets = ss.getSheets();
  const result = [];

  sheets.forEach(sheet => {
    const sheetName = sheet.getName();

    // 「_」始まりや「設定」シートは除外
    if (sheetName.startsWith('_') || sheetName === '設定') return;

    const rows = sheet.getDataRange().getValues();
    if (rows.length < 2) return; // ヘッダー行のみ＝データなし

    // 最新の報告行（最終行）を取得
    const r = rows[rows.length - 1];

    result.push({
      project:      sheetName,
      reportDate:   r[0] ? Utilities.formatDate(new Date(r[0]), 'Asia/Tokyo', 'yyyy/MM/dd') : '',
      person:       r[1] || '',
      status:       r[2] || '未入力',  // 事業全体ステータス（ダッシュボードの主ステータス）
      weeklyStatus: r[3] || '未入力',  // 今週の作業ステータス
      weeklyTask:   r[4] || '',        // 今週達成したタスク
      issues:       r[5] || '',        // 課題・リスク
      nextWeek:     r[6] || '',        // 来週のタスク
      notes:        r[7] || '',        // その他
    });
  });

  return ContentService
    .createTextOutput(JSON.stringify({ projects: result, fetchedAt: new Date().toISOString() }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── フォーム受信（入力フォームからのPOSTを受け取る） ────────────
function doPost(e) {
  try {
    const p = e.parameter;

    const project      = (p.project      || '').trim();
    const person       = (p.person       || '').trim();
    const overallStatus = (p.overallStatus || '順調').trim();
    const weeklyStatus  = (p.weeklyStatus  || '順調').trim();
    const weeklyTask   = (p.weeklyTask   || '').trim();
    const issues       = (p.issues       || '').trim();
    const nextWeek     = (p.nextWeek     || '').trim();
    const notes        = (p.notes        || '').trim();

    if (!project || !person) {
      return jsonResponse({ ok: false, error: 'project と person は必須です' });
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(project);

    // シートが存在しない場合は新規作成してヘッダーを追加
    if (!sheet) {
      sheet = ss.insertSheet(project);
      sheet.appendRow([
        '報告日', '担当者名',
        '事業全体ステータス', '今週の作業ステータス',
        '今週達成したタスク', '課題・リスク',
        '来週のタスク', 'その他'
      ]);
      // ヘッダー行を太字・背景色に設定
      const header = sheet.getRange(1, 1, 1, 8);
      header.setFontWeight('bold');
      header.setBackground('#f1f5f9');
    }

    const today = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy/MM/dd');
    sheet.appendRow([today, person, overallStatus, weeklyStatus, weeklyTask, issues, nextWeek, notes]);

    return jsonResponse({ ok: true });

  } catch (err) {
    return jsonResponse({ ok: false, error: err.message });
  }
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
