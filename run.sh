#!/bin/bash
# ============================================================
# run.sh — 毎週月曜日にこれ1つ実行するだけ
# 使い方: bash run.sh
# ============================================================

set -e  # エラーがあれば即停止

echo ""
echo "======================================"
echo "  週次進捗ダッシュボード — 実行開始"
echo "======================================"
echo ""

# .env の存在確認
if [ ! -f ".env" ]; then
  echo "❌ .env ファイルが見つかりません。"
  echo "   .env.example をコピーして .env を作成し、各値を設定してください。"
  exit 1
fi

echo "📡 Step 1/6: スプレッドシートからデータ取得..."
node scripts/fetch-sheets.js

echo ""
echo "🤖 Step 2/6: Gemini でAI要約を生成..."
node scripts/summarize.js

echo ""
echo "📊 Step 3/6: ダッシュボード & カードHTML生成..."
node scripts/generate-dashboard.js

echo ""
echo "🚀 Step 4/6: Surge.sh に公開..."
node scripts/deploy.js

echo ""
echo "📸 Step 5/6: カードごとにスクリーンショット撮影..."
node scripts/screenshot.js

echo ""
echo "📤 Step 6/6: Slack に画像投稿..."
node scripts/post-slack.js

echo ""
echo "======================================"
echo "  ✅ すべての処理が完了しました！"
echo "======================================"
echo ""
