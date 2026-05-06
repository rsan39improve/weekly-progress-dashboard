/**
 * generate-dashboard.js
 * output/data.json を読み込み、以下を生成する:
 *   - output/dashboard.html        ← Surge.sh で公開するダッシュボード
 *   - output/cards/{name}.html     ← Slack画像投稿用の個別カード（外部依存なし）
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs';

const data = JSON.parse(readFileSync('output/data.json', 'utf-8'));
const { projects, fetchedAt } = data;

const reportDate = new Date().toLocaleDateString('ja-JP', {
  year: 'numeric', month: 'long', day: 'numeric', weekday: 'long'
});

// ── ヘルパー ─────────────────────────────────────────────────────

function sanitizeFilename(name) {
  return name.replace(/[\\/:*?"<>|]/g, '_');
}

function safeHtml(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// 改行を <br> に変換（カード内のテキストエリア入力用）
function safeHtmlWithBreaks(s) {
  return safeHtml(s).replace(/\n/g, '<br>');
}

// ステータスに応じた色設定（ダッシュボード用）
function getStatusStyle(status) {
  switch (status) {
    case '順調': return { bg: '#dcfce7', border: '#16a34a', text: '#15803d', dot: '#22c55e', label: '順調' };
    case '停滞':
    case '注意': return { bg: '#fef9c3', border: '#ca8a04', text: '#a16207', dot: '#eab308', label: status };
    case '危険': return { bg: '#fee2e2', border: '#dc2626', text: '#b91c1c', dot: '#ef4444', label: '危険' };
    default:     return { bg: '#f1f5f9', border: '#94a3b8', text: '#475569', dot: '#94a3b8', label: status || '未入力' };
  }
}

// ステータスに応じたカード設定（インラインCSS用・外部依存なし）
function getCardTheme(status) {
  switch (status) {
    case '順調':
      return {
        headerBg: '#22c55e', emoji: '🟢', label: '順調',
        icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/>',
        badgeBg: '#dcfce7', badgeText: '#15803d', badgeBorder: '#86efac',
        issueBg: '#f0fdf4', issueBorder: '#86efac', issueText: '#14532d', issueLabel: '#15803d',
      };
    case '停滞':
    case '注意':
      return {
        headerBg: '#f59e0b', emoji: '🟡', label: status,
        icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>',
        badgeBg: '#fef3c7', badgeText: '#92400e', badgeBorder: '#fcd34d',
        issueBg: '#fffbeb', issueBorder: '#fcd34d', issueText: '#78350f', issueLabel: '#d97706',
      };
    case '危険':
      return {
        headerBg: '#ef4444', emoji: '🔴', label: '危険',
        icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>',
        badgeBg: '#fee2e2', badgeText: '#991b1b', badgeBorder: '#fca5a5',
        issueBg: '#fef2f2', issueBorder: '#fca5a5', issueText: '#7f1d1d', issueLabel: '#dc2626',
      };
    default:
      return {
        headerBg: '#94a3b8', emoji: '⚫', label: status || '未入力',
        icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 9v6m4-6v6"/>',
        badgeBg: '#f1f5f9', badgeText: '#475569', badgeBorder: '#cbd5e1',
        issueBg: '#f8fafc', issueBorder: '#e2e8f0', issueText: '#475569', issueLabel: '#64748b',
      };
  }
}

// ── ソート順 ─────────────────────────────────────────────────────
const STATUS_ORDER = { '危険': 0, '停滞': 1, '注意': 1, '順調': 2 };
function sortProjects(list) {
  return [...list].sort((a, b) => (STATUS_ORDER[a.status] ?? 3) - (STATUS_ORDER[b.status] ?? 3));
}

// ── 全体カウント ─────────────────────────────────────────────────
const counts = { 順調: 0, 停滞: 0, 危険: 0 };
projects.forEach(p => {
  if (p.status === '順調') counts['順調']++;
  else if (p.status === '危険') counts['危険']++;
  else counts['停滞']++;
});
const overallStatus = counts['危険'] > 0 ? '要対応あり' : counts['停滞'] > 0 ? '要注意' : '全体順調';
const overallColor  = counts['危険'] > 0 ? '#ef4444'    : counts['停滞'] > 0 ? '#f59e0b' : '#22c55e';
const overallPulse  = counts['危険'] > 0 ? 'animate-pulse' : '';

// ── ダッシュボード用プロジェクトカード ───────────────────────────
function projectCard(p) {
  const s = getStatusStyle(p.status);
  const ws = getStatusStyle(p.weeklyStatus || p.status);

  const issueBlock = p.issues
    ? `<div style="background:#fff7ed;border-left:3px solid #f97316;padding:10px 14px;border-radius:0 8px 8px 0;margin-top:12px;">
        <div style="font-size:11px;font-weight:700;color:#ea580c;margin-bottom:3px;">⚠ 課題・リスク</div>
        <div style="font-size:13px;color:#431407;line-height:1.8;">${safeHtmlWithBreaks(p.issues)}</div>
      </div>`
    : `<div style="font-size:12px;color:#15803d;background:#f0fdf4;border-radius:8px;padding:8px 12px;margin-top:12px;">✅ 課題・リスクなし</div>`;

  return `
    <div style="background:white;border:2px solid ${s.border};border-radius:14px;overflow:hidden;break-inside:avoid;">
      <!-- カードヘッダー -->
      <div style="background:${s.bg};border-bottom:1px solid ${s.border};padding:14px 18px;display:flex;align-items:center;justify-content:space-between;gap:8px;">
        <div style="display:flex;align-items:center;gap:10px;">
          <div style="width:10px;height:10px;border-radius:50%;background:${s.dot};flex-shrink:0;"></div>
          <span style="font-size:15px;font-weight:900;color:#1e293b;">${safeHtml(p.project)}</span>
        </div>
        <div style="display:flex;gap:6px;align-items:center;flex-shrink:0;">
          <div style="background:${s.bg};border:1px solid ${s.border};border-radius:9999px;padding:3px 10px;font-size:12px;font-weight:700;color:${s.text};">
            ${s.label}
          </div>
        </div>
      </div>

      <!-- カード本体 -->
      <div style="padding:16px 18px;">
        <!-- 担当・日付 -->
        <div style="font-size:12px;color:#94a3b8;margin-bottom:12px;">
          担当: <strong style="color:#64748b;">${safeHtml(p.person)}</strong>
          &nbsp;|&nbsp; ${safeHtml(p.reportDate)}
        </div>

        <!-- 2ステータスグリッド -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px;">
          <div style="background:${s.bg};border:1px solid ${s.border};border-radius:10px;padding:10px;text-align:center;">
            <div style="font-size:10px;font-weight:700;color:#64748b;margin-bottom:5px;">📊 事業全体</div>
            <div style="font-size:13px;font-weight:900;color:${s.text};">${s.label}</div>
          </div>
          <div style="background:${ws.bg};border:1px solid ${ws.border};border-radius:10px;padding:10px;text-align:center;">
            <div style="font-size:10px;font-weight:700;color:#64748b;margin-bottom:5px;">📋 今週の作業</div>
            <div style="font-size:13px;font-weight:900;color:${ws.text};">${ws.label}</div>
          </div>
        </div>

        <!-- 今週達成したタスク -->
        ${p.weeklyTask ? `
          <div style="margin-bottom:10px;">
            <div style="font-size:11px;font-weight:700;color:#64748b;margin-bottom:4px;">今週達成したタスク</div>
            <div style="font-size:13px;color:#334155;line-height:1.8;">${safeHtmlWithBreaks(p.weeklyTask)}</div>
          </div>` : ''}

        <!-- 課題・リスク -->
        ${issueBlock}

        <!-- 来週のタスク -->
        ${p.nextWeek ? `
          <div style="margin-top:12px;">
            <div style="font-size:11px;font-weight:700;color:#64748b;margin-bottom:4px;">来週のタスク</div>
            <div style="font-size:13px;color:#334155;line-height:1.8;">${safeHtmlWithBreaks(p.nextWeek)}</div>
          </div>` : ''}
      </div>
    </div>
  `;
}

// ── サマリーカード ───────────────────────────────────────────────
function summaryCard(label, count, color) {
  return `
    <div style="background:white;border:1.5px solid ${color}30;border-radius:12px;padding:16px;text-align:center;box-shadow:0 1px 4px rgba(0,0,0,0.05);">
      <div style="font-size:32px;font-weight:900;color:${color};line-height:1.1;">${count}</div>
      <div style="font-size:12px;color:#64748b;margin-top:6px;">${label}</div>
    </div>
  `;
}

// ── ダッシュボードHTML ────────────────────────────────────────────
const dashboardHtml = `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>週次進捗ダッシュボード</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Hiragino Sans', 'Hiragino Kaku Gothic ProN', 'Yu Gothic UI', 'Meiryo', sans-serif;
      background: #f1f5f9;
      color: #334155;
      line-height: 1.6;
    }
    .container { max-width: 920px; margin: 0 auto; padding: 28px 16px; }
    .grid-2 { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; }
    .grid-4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
    @media (max-width: 640px) {
      .grid-2 { grid-template-columns: 1fr; }
      .grid-4 { grid-template-columns: repeat(2, 1fr); }
    }
    @media print {
      body { background: white; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
<div class="container">

  <!-- ヘッダー -->
  <div style="background:white;border-top:4px solid #3b82f6;border-radius:0 0 14px 14px;padding:22px 26px;margin-bottom:20px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;box-shadow:0 1px 4px rgba(0,0,0,0.06);">
    <div>
      <div style="font-size:12px;color:#94a3b8;margin-bottom:4px;">📅 ${reportDate}</div>
      <h1 style="font-size:22px;font-weight:900;color:#1e293b;">プロジェクト進捗ダッシュボード</h1>
    </div>
    <div style="display:flex;align-items:center;gap:8px;background:${overallColor}15;border:1.5px solid ${overallColor}40;border-radius:9999px;padding:8px 18px;">
      <div style="width:10px;height:10px;border-radius:50%;background:${overallColor};"></div>
      <span style="font-weight:800;color:${overallColor};font-size:14px;">${overallStatus}</span>
    </div>
  </div>

  <!-- サマリー -->
  <div class="grid-4" style="margin-bottom:20px;">
    ${summaryCard('全プロジェクト', projects.length, '#3b82f6')}
    ${summaryCard('順調', counts['順調'], '#22c55e')}
    ${summaryCard('停滞', counts['停滞'], '#f59e0b')}
    ${summaryCard('危険', counts['危険'], '#ef4444')}
  </div>

  <!-- プロジェクトカード一覧（危険 → 停滞 → 順調） -->
  <div class="grid-2">
    ${sortProjects(projects).map(projectCard).join('\n')}
  </div>

  <!-- フッター -->
  <div style="text-align:center;margin-top:28px;font-size:11px;color:#cbd5e1;">
    データ取得: ${new Date(fetchedAt).toLocaleString('ja-JP')}
  </div>

</div>
</body>
</html>`;

// ── Slack投稿用スタンドアロンカードHTML ──────────────────────────
function generateCardHtml(p, date) {
  const t  = getCardTheme(p.status);
  const wt = getCardTheme(p.weeklyStatus || p.status);

  const issueBlock = p.issues
    ? `<div class="sec" style="margin-bottom:0;">
        <div class="sec-bar" style="background:${t.issueBorder};"></div>
        <div>
          <div class="sec-lbl" style="color:${t.issueLabel};">⚠ 課題・リスク</div>
          <div class="sec-txt" style="color:${t.issueText};line-height:1.8;">${safeHtmlWithBreaks(p.issues)}</div>
        </div>
      </div>`
    : `<div class="sec" style="margin-bottom:0;">
        <div class="sec-bar" style="background:#86efac;"></div>
        <div>
          <div class="sec-lbl" style="color:#15803d;">課題・リスクなし</div>
        </div>
      </div>`;

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <title>${safeHtml(p.project)} — 週次レポート</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      width: 640px;
      font-family: 'Hiragino Sans', 'Hiragino Kaku Gothic ProN', 'Yu Gothic UI', 'Meiryo', sans-serif;
      background: #f1f5f9;
    }
    .card { width: 640px; background: white; border-left: 8px solid ${t.headerBg}; border-radius: 0 0 16px 16px; overflow: hidden; box-shadow: 0 4px 16px rgba(0,0,0,0.10); }
    .hd { background:${t.headerBg}; padding:18px 24px; display:flex; align-items:center; justify-content:space-between; }
    .hd-l { display:flex; align-items:center; gap:12px; }
    .hd-icon { background:rgba(255,255,255,0.2); border-radius:10px; padding:8px; display:flex; }
    .hd-date { color:rgba(255,255,255,0.75); font-size:11px; font-weight:500; margin-bottom:2px; }
    .hd-name { color:white; font-size:20px; font-weight:900; }
    .hd-badge { background:white; border-radius:12px; padding:8px 14px; text-align:center; min-width:60px; }
    .hd-badge-e { font-size:18px; line-height:1; }
    .hd-badge-l { font-size:13px; font-weight:900; color:${t.headerBg}; margin-top:2px; }
    .body { padding:20px 24px; }
    .person { font-size:13px; color:#64748b; margin-bottom:14px; }
    .person strong { color:#334155; font-weight:700; }
    .sg { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:16px; }
    .sc { border-radius:12px; padding:12px 14px; text-align:center; border:1px solid; }
    .sc-lbl { font-size:11px; font-weight:700; color:#64748b; margin-bottom:8px; }
    .sp { display:inline-flex; align-items:center; gap:5px; border-radius:9999px; padding:5px 12px; }
    .divider { height:1px; background:#f1f5f9; margin:16px 0; }
    .sec { display:flex; gap:12px; margin-bottom:14px; }
    .sec-bar { width:3px; border-radius:9999px; flex-shrink:0; margin-top:2px; }
    .sec-lbl { font-size:13px; font-weight:700; color:#64748b; margin-bottom:4px; }
    .sec-txt { font-size:13px; color:#334155; line-height:1.8; }
  </style>
</head>
<body>
<div class="card">
  <div class="hd">
    <div class="hd-l">
      <div class="hd-icon">
        <svg width="24" height="24" fill="none" stroke="white" stroke-width="2.5" viewBox="0 0 24 24">${t.icon}</svg>
      </div>
      <div>
        <div class="hd-date">${safeHtml(date)}　週次レポート</div>
        <div class="hd-name">${safeHtml(p.project)}</div>
      </div>
    </div>
    <div class="hd-badge">
      <div class="hd-badge-e">${t.emoji}</div>
      <div class="hd-badge-l">${t.label}</div>
    </div>
  </div>
  <div class="body">
    <div class="person">担当: <strong>${safeHtml(p.person)}</strong></div>
    <div class="sg">
      <div class="sc" style="background:${t.badgeBg};border-color:${t.badgeBorder};">
        <div class="sc-lbl">📊 事業全体のステータス</div>
        <div class="sp" style="background:${t.badgeBg};">
          <span style="font-size:14px;">${t.emoji}</span>
          <span style="font-size:13px;font-weight:900;color:${t.badgeText};">${t.label}</span>
        </div>
      </div>
      <div class="sc" style="background:${wt.badgeBg};border-color:${wt.badgeBorder};">
        <div class="sc-lbl">📋 今週の作業ステータス</div>
        <div class="sp" style="background:${wt.badgeBg};">
          <span style="font-size:14px;">${wt.emoji}</span>
          <span style="font-size:13px;font-weight:900;color:${wt.badgeText};">${wt.label}</span>
        </div>
      </div>
    </div>
    <div class="divider"></div>
    ${p.weeklyTask ? `
    <div class="sec">
      <div class="sec-bar" style="background:#60a5fa;"></div>
      <div>
        <div class="sec-lbl">今週達成したタスク</div>
        <div class="sec-txt">${safeHtmlWithBreaks(p.weeklyTask)}</div>
      </div>
    </div>` : ''}
    ${issueBlock}
    ${p.nextWeek ? `
    <div class="sec" style="margin-top:14px;margin-bottom:0;">
      <div class="sec-bar" style="background:#cbd5e1;"></div>
      <div>
        <div class="sec-lbl">来週のタスク</div>
        <div class="sec-txt">${safeHtmlWithBreaks(p.nextWeek)}</div>
      </div>
    </div>` : ''}
  </div>
</div>
</body>
</html>`;
}

// ── ファイル出力 ─────────────────────────────────────────────────
mkdirSync('output', { recursive: true });
writeFileSync('output/dashboard.html', dashboardHtml, 'utf-8');
console.log('✅ ダッシュボードを生成しました: output/dashboard.html');

mkdirSync('output/cards', { recursive: true });
const cardDate = new Date().toLocaleDateString('ja-JP', {
  year: 'numeric', month: 'long', day: 'numeric', weekday: 'short'
});
projects.forEach(p => {
  const html = generateCardHtml(p, cardDate);
  writeFileSync(`output/cards/${sanitizeFilename(p.project)}.html`, html, 'utf-8');
});
console.log(`✅ 個別カードHTMLを生成しました: output/cards/ （${projects.length}件）`);
