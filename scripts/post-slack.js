/**
 * post-slack.js — Phase 1（テキスト投稿専用）
 *
 * スプレッドシートのデータをもとに、Slackへテキストで週次レポートを投稿する。
 * 画像生成（Playwright）は Phase 2 以降で追加する。
 *
 * 必要な環境変数:
 *   SLACK_BOT_TOKEN   — Slack Bot の OAuth トークン（xoxb-...）
 *   SLACK_CHANNEL_ID  — 投稿先チャンネルID（例: C0123456789）
 */

import 'dotenv/config';
import { readFileSync, existsSync } from 'fs';
import { WebClient } from '@slack/web-api';

// ── 環境変数チェック ──────────────────────────────────────────────
const BOT_TOKEN = process.env.SLACK_BOT_TOKEN;
const CHANNEL_ID = process.env.SLACK_CHANNEL_ID;

if (!BOT_TOKEN) {
  console.error('❌ SLACK_BOT_TOKEN が設定されていません。');
  process.exit(1);
}
if (!CHANNEL_ID) {
  console.error('❌ SLACK_CHANNEL_ID が設定されていません。');
  process.exit(1);
}

// ── データ読み込み ────────────────────────────────────────────────
if (!existsSync('output/data.json')) {
  console.error('❌ output/data.json が見つかりません。先に fetch-sheets.js を実行してください。');
  process.exit(1);
}

const { projects } = JSON.parse(readFileSync('output/data.json', 'utf-8'));

// ── ヘルパー ─────────────────────────────────────────────────────
function statusEmoji(s) {
  if (s === '順調') return ':large_green_circle:';
  if (s === '危険') return ':red_circle:';
  if (s === '停滞' || s === '注意') return ':large_yellow_circle:';
  return ':white_circle:';
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
  year: 'numeric', month: 'long', day: 'numeric', weekday: 'long',
  timeZone: 'Asia/Tokyo'
});
const hasDanger = counts['危険'] > 0;
const overallIcon = hasDanger ? ':rotating_light:' : counts['停滞'] > 0 ? ':warning:' : ':white_check_mark:';

// ── Slack クライアント初期化 ──────────────────────────────────────
const slack = new WebClient(BOT_TOKEN);

// ── サマリーを投稿 ────────────────────────────────────────────────
console.log('📨 Slack にサマリーを投稿中...');

const summaryRes = await slack.chat.postMessage({
  channel: CHANNEL_ID,
  text: `${overallIcon} 週次進捗レポート — ${today}`,
  blocks: [
    {
      type: 'header',
      text: { type: 'plain_text', text: `週次進捗レポート — ${today}`, emoji: true }
    },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `:large_green_circle: 順調　*${counts['順調']}件*` },
        { type: 'mrkdwn', text: `:large_yellow_circle: 停滞　*${counts['停滞']}件*` },
        { type: 'mrkdwn', text: `:red_circle: 危険　*${counts['危険']}件*` },
        { type: 'mrkdwn', text: `全案件　*${projects.length}件*` },
      ]
    },
    { type: 'divider' }
  ]
});

if (!summaryRes.ok) {
  console.error(`❌ サマリー投稿に失敗しました: ${summaryRes.error}`);
  process.exit(1);
}
console.log('   ✅ サマリー投稿完了');

// ── プロジェクトごとの詳細を投稿 ─────────────────────────────────
console.log(`\n📋 ${sorted.length} 件のプロジェクト詳細を投稿中...`);

for (const p of sorted) {
  const icon = statusEmoji(p.status);
  const lines = [
    `${icon} *${p.project}*（担当: ${p.person || '未入力'}）`,
    `状況: ${p.status || '未入力'}　週次: ${p.weeklyStatus || '未入力'}`,
  ];
  if (p.weeklyTask) lines.push(`✅ 今週: ${p.weeklyTask}`);
  if (p.issues)    lines.push(`⚠ 課題: ${p.issues}`);
  if (p.nextWeek)  lines.push(`→ 来週: ${p.nextWeek}`);

  try {
    await slack.chat.postMessage({
      channel: CHANNEL_ID,
      text: lines.join('\n'),
    });
    console.log(`   ✅ ${p.project}`);
  } catch (err) {
    console.error(`   ❌ エラー (${p.project}): ${err.message}`);
  }
}

console.log('\n✅ Slack への投稿がすべて完了しました');
