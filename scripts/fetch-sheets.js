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

let data;
try {
  const res = await fetch(GAS_URL);
  if (!res.ok) {
    console.error(`❌ データ取得に失敗しました（HTTPステータス: ${res.status}）`);
    process.exit(1);
  }
  data = await res.json();
} catch (err) {
  console.error(`❌ データ取得中にエラーが発生しました: ${err.message}`);
  process.exit(1);
}

if (!data || !Array.isArray(data.projects)) {
  console.error('❌ GASから取得したデータの形式が正しくありません。GASの設定を確認してください。');
  process.exit(1);
}

// ── 直近7日以内に報告されたプロジェクトだけに絞る ────────────────
// 月曜朝に実行されるため「先週金曜〜日曜に入力した分」が対象になる
const now = new Date();
const cutoff = new Date(now);
cutoff.setDate(now.getDate() - 7); // 7日前より新しいデータのみ

const allProjects = data.projects;
const recentProjects = allProjects.filter(p => {
  if (!p.reportDate) return false;
  const reportDate = new Date(p.reportDate);
  return reportDate >= cutoff;
});

const filteredData = { ...data, projects: recentProjects };

mkdirSync('output', { recursive: true });
writeFileSync('output/data.json', JSON.stringify(filteredData, null, 2), 'utf-8');

console.log(`✅ 全 ${allProjects.length} 件中、直近7日以内の報告: ${recentProjects.length} 件`);
if (allProjects.length !== recentProjects.length) {
  const skipped = allProjects.filter(p => !recentProjects.includes(p));
  skipped.forEach(p => {
    console.log(`   ⏭ スキップ（古いデータ）: ${p.project}（${p.reportDate}）`);
  });
}
recentProjects.forEach(p => {
  const icon = p.status === '順調' ? '🟢' : p.status === '注意' ? '🟡' : p.status === '危険' ? '🔴' : '⚫';
  console.log(`   ${icon} ${p.project}（${p.person}）: ${p.status}`);
});
