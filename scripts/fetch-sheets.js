/**
 * fetch-sheets.js
 * Google Apps Script の公開URLからプロジェクトデータを取得し
 * output/data.json に保存する
 */

import 'dotenv/config';
import { writeFileSync, mkdirSync } from 'fs';

const GAS_URL = process.env.GAS_URL;

if (!GAS_URL || GAS_URL.includes('ここに')) {
  console.error('❌ .env の GAS_URL が設定されていません。README.md の手順を確認してください。');
  process.exit(1);
}

console.log('📡 Google スプレッドシートからデータを取得中...');

const res = await fetch(GAS_URL);
if (!res.ok) {
  console.error(`❌ データ取得に失敗しました（HTTPステータス: ${res.status}）`);
  process.exit(1);
}

const data = await res.json();

mkdirSync('output', { recursive: true });
writeFileSync('output/data.json', JSON.stringify(data, null, 2), 'utf-8');

console.log(`✅ ${data.projects.length} 件のプロジェクトを取得しました`);
data.projects.forEach(p => {
  const icon = p.status === '順調' ? '🟢' : p.status === '注意' ? '🟡' : p.status === '危険' ? '🔴' : '⚫';
  console.log(`   ${icon} ${p.project}（${p.person}）: ${p.status} ${p.progress}%`);
});
