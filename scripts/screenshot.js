/**
 * screenshot.js
 * Playwright でプロジェクトカードを1枚ずつスクリーンショット撮影する
 *
 * 入力: output/cards/*.html（generate-dashboard.js が生成）
 * 出力: output/screenshots/{プロジェクト名}.png
 */

import { chromium } from 'playwright';
import { readdirSync, mkdirSync, existsSync } from 'fs';
import { resolve, basename, extname } from 'path';

const CARD_DIR = 'output/cards';
const OUT_DIR = 'output/screenshots';
const CARD_WIDTH = 640;

if (!existsSync(CARD_DIR)) {
  console.error('❌ output/cards/ が見つかりません。先に generate-dashboard.js を実行してください。');
  process.exit(1);
}

const cardFiles = readdirSync(CARD_DIR).filter(f => f.endsWith('.html'));
if (cardFiles.length === 0) {
  console.error('❌ output/cards/ にHTMLファイルがありません。');
  process.exit(1);
}

mkdirSync(OUT_DIR, { recursive: true });

console.log(`📸 ${cardFiles.length} 件のカードをスクリーンショット撮影します...`);

const browser = await chromium.launch();

try {
  for (const file of cardFiles) {
    const projectName = basename(file, extname(file));
    const filePath = resolve(`${CARD_DIR}/${file}`);
    const outPath = `${OUT_DIR}/${projectName}.png`;

    const page = await browser.newPage();
    try {
      // カード幅 640px に合わせたビューポート（高さは後でコンテンツに合わせる）
      await page.setViewportSize({ width: CARD_WIDTH, height: 800 });
      await page.goto(`file://${filePath}`, { waitUntil: 'load' });

      // コンテンツ高さに合わせてビューポートを調整し、余白なしでキャプチャ
      const cardHeight = await page.evaluate(() => {
        const el = document.querySelector('.card');
        return el ? Math.ceil(el.getBoundingClientRect().height) : document.body.scrollHeight;
      });
      await page.setViewportSize({ width: CARD_WIDTH, height: cardHeight });

      await page.screenshot({ path: outPath, clip: { x: 0, y: 0, width: CARD_WIDTH, height: cardHeight } });
      console.log(`   ✅ ${projectName}.png`);
    } catch (err) {
      console.error(`   ❌ スクリーンショット失敗 (${projectName}): ${err.message}`);
    } finally {
      await page.close();
    }
  }
} finally {
  // 成功・失敗に関わらず必ずブラウザを閉じる
  await browser.close();
}

console.log(`\n✅ スクリーンショットを保存しました: ${OUT_DIR}/`);
