/**
 * summarize.js
 * Gemini API を使って各プロジェクトの一言要約と今週の動向を生成する
 *
 * 入力: output/data.json
 * 出力: output/summary.json
 */

import 'dotenv/config';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { GoogleGenerativeAI } from '@google/generative-ai';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  console.error('❌ GEMINI_API_KEY が設定されていません。.env を確認してください。');
  process.exit(1);
}

if (!existsSync('output/data.json')) {
  console.error('❌ output/data.json が見つかりません。先に fetch-sheets.js を実行してください。');
  process.exit(1);
}

const { projects } = JSON.parse(readFileSync('output/data.json', 'utf-8'));

if (!projects || projects.length === 0) {
  console.warn('⚠ 対象プロジェクトが0件のため、要約をスキップします。');
  writeFileSync('output/summary.json', JSON.stringify({ projectSummaries: [], weeklyTrend: '' }, null, 2), 'utf-8');
  process.exit(0);
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-lite' });

// ── プロジェクトごとの一言要約 ────────────────────────────────────
console.log('🤖 Gemini: 各プロジェクトの一言要約を生成中...');

const projectSummaries = [];

for (const p of projects) {
  const prompt = `
あなたはプロジェクトマネジメントの補佐AIです。
以下のプロジェクト週次報告を読み、マネジメント者向けに20〜40文字の一言要約を日本語で生成してください。
要約は「〜が進行中」「〜に注意が必要」「〜を推奨」などの形式で、簡潔かつ具体的に書いてください。
記号や絵文字は使わないでください。

プロジェクト名: ${p.project}
担当者: ${p.person}
全体ステータス: ${p.status}
今週のステータス: ${p.weeklyStatus}
今週達成したタスク: ${p.weeklyTask || 'なし'}
課題・リスク: ${p.issues || 'なし'}
来週のタスク: ${p.nextWeek || 'なし'}
`.trim();

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim().replace(/\n/g, '');
    projectSummaries.push({ project: p.project, summary: text });
    console.log(`   ✅ ${p.project}: ${text}`);
  } catch (err) {
    console.error(`   ❌ ${p.project} の要約生成に失敗: ${err.message}`);
    projectSummaries.push({ project: p.project, summary: '要約を生成できませんでした。' });
  }
}

// ── 今週の動向（全体サマリー） ────────────────────────────────────
console.log('\n🤖 Gemini: 今週の動向を生成中...');

const allProjectsText = projects.map(p => `
【${p.project}】担当:${p.person} / ステータス:${p.status} / 今週:${p.weeklyStatus}
今週のタスク: ${p.weeklyTask || 'なし'}
課題: ${p.issues || 'なし'}
来週: ${p.nextWeek || 'なし'}
`).join('\n');

const trendPrompt = `
あなたはプロジェクトマネジメントの補佐AIです。
以下の複数プロジェクトの週次報告を読み、マネジメント者向けに「今週の動向」を60〜120文字の日本語で生成してください。
全体の状況、特に注意すべき点、来週に向けたアクションを簡潔にまとめてください。
箇条書きにせず、自然な文章で書いてください。記号や絵文字は使わないでください。

${allProjectsText}
`.trim();

let weeklyTrend = '';
try {
  const result = await model.generateContent(trendPrompt);
  weeklyTrend = result.response.text().trim().replace(/\n+/g, ' ');
  console.log(`   ✅ 今週の動向: ${weeklyTrend}`);
} catch (err) {
  console.error(`   ❌ 今週の動向の生成に失敗: ${err.message}`);
  weeklyTrend = '今週の動向を生成できませんでした。';
}

// ── 出力 ────────────────────────────────────────────────────────
const output = { projectSummaries, weeklyTrend };
writeFileSync('output/summary.json', JSON.stringify(output, null, 2), 'utf-8');
console.log('\n✅ 要約を保存しました: output/summary.json');
