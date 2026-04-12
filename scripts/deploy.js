/**
 * deploy.js
 * output/dashboard.html を Surge.sh に公開し、URLを output/url.txt に保存する
 */

import 'dotenv/config';
import { execSync } from 'child_process';
import { writeFileSync, readFileSync } from 'fs';

const domain = process.env.SURGE_DOMAIN;
if (!domain || domain.includes('my-team')) {
  console.error('❌ .env の SURGE_DOMAIN が設定されていません。');
  process.exit(1);
}

const url = `https://${domain}.surge.sh`;
console.log(`🚀 Surge.sh に公開中... → ${url}`);

try {
  execSync(`npx --yes surge output/dashboard.html --domain ${domain}.surge.sh`, { stdio: 'inherit' });
  writeFileSync('output/url.txt', url, 'utf-8');
  console.log(`✅ 公開完了: ${url}`);
} catch (e) {
  console.error('❌ Surge への公開に失敗しました。surge login を実行してから再試行してください。');
  process.exit(1);
}
