/**
 * post-slack.js
 * Slack Bot Token + @slack/web-api で
 * テキストサマリー投稿 → プロジェクトカード画像を1枚ずつアップロード
 *
 * 必要な環境変数:
 *   SLACK_BOT_TOKEN   — Slack Bot の OAuth トークン（xoxb-...）
 *   SLACK_CHANNEL_ID  — 投稿先チャンネルID（例: C0123456789）
 */

import 'dotenv/config';
import { readFileSync, existsSync, readdirSync } from 'fs';
import { basename, extname } from 'path';
import { WebClient } from '@slack/web-api';

// ── 環境変数チェック ──────────────────────────────────────────────
const BOT_TOKEN = process.env.SLACK_BOT_TOKEN;
const CHANNEL_ID = process.env.SLACK_CHANNEL_ID;

if (!BOT_TOKEN || BOT_TOKEN.includes('xoxb-ここに')) {
  console.error('❌ .env の SLACK_BOT_TOKEN が設定されていません。README.md を確認してください。');
  process.exit(1);
}
if (!CHANNEL_ID || CHANNEL_ID.includes('ここに')) {
  console.error('❌ .env の SLACK_CHANNEL_ID が設定されていません。');
  process.exit(1);
}

// ── データ読み込み ────────────────────────────────────────────────
if (!existsSync('output/data.json')) {
  console.error('❌ output/data.json が見つかりません。先に fetch-sheets.js を実行してください。');
  process.exit(1);
}

const { projects } = JSON.parse(readFileSync('output/data.json', 'utf-8'));
const dashUrl = existsSync('output/url.txt') ? readFileSync('output/url.txt', 'utf-8').trim() : null;

const SCREENSHOT_DIR = 'output/screenshots';
if (!existsSync(SCREENSHOT_DIR)) {
  console.error('❌ output/screenshots/ が見つかりません。先に screenshot.js を実行してください。');
  process.exit(1);
}

// ── ヘルパー ─────────────────────────────────────────────────────
function statusEmoji(s) {
  return s === '順調' ? ':large_green_circle:' : s === '停滞' || s === '注意' ? ':large_yellow_circle:' : s === '危険' ? ':red_circle:' : ':white_circle:';
}

function sanitizeFilename(name) {
  return name.replace(/[\\/:*?"<>|]/g, '_');
}

// 危険 → 停滞 → 順調 の順にソート
const sorted = [...projects].sort((a, b) => {
  const order = { 危険: 0, 停滞: 1, 注意: 1, 順調: 2 };
  return (order[a.status] ?? 3) - (order[b.status] ?? 3);
});

const counts = { 順調: 0, 停滞: 0, 危険: 0 };
projects.forEach(p => {
  if (p.status === '順調') counts['順調']++;
  else if (p.status === '危険') counts['危険']++;
  else counts['停滞']++;
});

const today = new Date().toLocaleDateString('ja-JP', {
  year: 'numeric', month: 'long', day: 'numeric', weekday: 'long'
});
const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
const hasDanger = counts['危険'] > 0;

// ── Slack クライアント初期化 ──────────────────────────────────────
const slack = new WebClient(BOT_TOKEN);

// ── Step 1: テキストサマリーを投稿 ───────────────────────────────
console.log('📨 Slack にサマリーを投稿中...');

const overallIcon = hasDanger ? ':rotating_light:' : counts['停滞'] + counts['注意'] > 0 ? ':warning:' : ':white_check_mark:';

const summaryRes = await slack.chat.postMessage({
  channel: CHANNEL_ID,
  text: `${overallIcon} 週次進捗レポート — ${today}`,
  blocks: [
    {
      type: 'header',
      text: { type: 'plain_text', text: `週次進捗レポート — ${today}` }
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: [
          `*サマリー*`,
          `:large_green_circle: 順調 *${counts['順調']}件*`,
          `:large_yellow_circle: 停滞 *${counts['停滞']}件*`,
          `:red_circle: 危険 *${counts['危険']}件*`,
          ...(dashUrl ? [`\n*詳細ダッシュボード:* ${dashUrl}`] : []),
        ].join('　')
      }
    },
    {
      type: 'context',
      elements: [{ type: 'mrkdwn', text: '各プロジェクトの詳細は下の画像をご確認ください。' }]
    }
  ]
});

if (!summaryRes.ok) {
  console.error(`❌ サマリー投稿に失敗しました: ${summaryRes.error}`);
  process.exit(1);
}
console.log('   ✅ サマリー投稿完了');

// ── Step 2: プロジェクトカード画像を1枚ずつアップロード ─────────
console.log(`\n🖼  ${sorted.length} 件のカード画像を投稿中...`);

for (const project of sorted) {
  const safeName = sanitizeFilename(project.project);
  const imgPath = `${SCREENSHOT_DIR}/${safeName}.png`;

  if (!existsSync(imgPath)) {
    console.warn(`   ⚠ スクリーンショットが見つかりません（スキップ）: ${imgPath}`);
    continue;
  }

  const icon = project.status === '順調' ? '🟢' : project.status === '危険' ? '🔴' : '🟡';
  const initialComment = `${icon} *${project.project}*（担当: ${project.person}）`;

  try {
    const uploadRes = await slack.filesUploadV2({
      channel_id: CHANNEL_ID,
      filename: `${safeName}_進捗_${dateStr}.png`,
      file: readFileSync(imgPath),
      initial_comment: initialComment,
    });

    if (uploadRes.ok) {
      console.log(`   ✅ ${project.project}`);
    } else {
      console.error(`   ❌ アップロード失敗 (${project.project}): ${uploadRes.error}`);
    }
  } catch (err) {
    console.error(`   ❌ エラー (${project.project}): ${err.message}`);
  }
}

console.log('\n✅ Slack への投稿がすべて完了しました');
