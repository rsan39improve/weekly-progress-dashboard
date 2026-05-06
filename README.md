# 週次進捗ダッシュボード

チームメンバーが毎週末に入力した進捗を、月曜朝に自動でSlackへ画像レポートとして投稿するツールです。
冒頭にAI（Gemini）が生成したマネジメントサマリーカードを投稿し、続いて各プロジェクトカードを投稿します。

---

## 現在の実装スコープ（完成版）

### ✅ 実装済み（今すぐ動く）

| 機能 | 説明 |
|------|------|
| 入力フォーム | GitHub Pages で公開済み。スマホ・PCどこからでも入力可能 |
| データ保存 | GAS がスプレッドシートに自動保存 |
| データ取得 | GAS の doGet で Node.js がデータを取得 |
| AI要約生成 | Gemini が各プロジェクトの一言要約と今週の動向を自動生成 |
| AIサマリーカード | 全プロジェクトを1枚にまとめたマネジメント向け画像を生成 |
| カード画像生成 | プロジェクトごとにHTMLカードをPlaywrightで撮影 |
| Slack自動投稿 | 毎週月曜 8:00（JST）にGitHub Actionsが自動実行 |
| 直近データ絞り込み | 8日以内のデータのみ投稿（古いデータを除外） |

### 🔜 今後実装予定（未実装）

| 機能 | 優先度 | 概要 |
|------|--------|------|
| 金曜リマインダー通知 | 高 | 金曜16時・18時半にSlackで入力を促す |
| 未提出者の検知 | 高 | 提出がないプロジェクトをSlackで警告 |
| ルールベーススコアリング | 中 | 状況を点数化して判定を自動化 |
| 月次サマリー | 低 | 月単位でのプロジェクト状況まとめ |

---

## Slackへの投稿イメージ

```
【1枚目】週次マネジメントサマリー（AIが自動生成）
  ├ 全体ステータス（順調 / 要注意 / 要対応あり）
  ├ 進捗管理：順調○件・停滞○件・危険○件
  ├ 各プロジェクトのステータス + AI一言要約
  └ 今週の動向（AIによる全体コメント）

【2枚目以降】各プロジェクトカード（危険→停滞→順調の順）
  ├ 担当者・ステータス
  ├ 今週達成したタスク
  ├ 課題・リスク
  └ 来週のタスク
```

---

## 全体の流れ

```
【毎週末】担当者がブラウザでフォームに入力
          ↓ Google Apps Script（GAS）でスプレッドシートに自動保存
【毎週月曜 8:00 JST】GitHub Actions が自動実行
  1. スプレッドシートからデータ取得（直近8日以内）
  2. Gemini API でAI要約を生成
  3. HTMLダッシュボード + プロジェクトカード + サマリーカード生成
  4. カードごとにスクリーンショット撮影（Playwright）
  5. Slackにサマリー→各プロジェクトカード画像を投稿
```

---

## セットアップ手順

### Step 1 — Node.js のインストール確認

```bash
node -v   # v18以上を確認
npm -v
```

インストールされていない場合は [https://nodejs.org](https://nodejs.org) からダウンロード。

---

### Step 2 — Google スプレッドシートの準備

1. Google スプレッドシートを新規作成
2. **プロジェクト数分のシートを作成**（シート名 = プロジェクト名）
3. 各シートの **1行目にヘッダーを追加**（コピー&ペーストでOK）

| A | B | C | D | E | F | G | H |
|---|---|---|---|---|---|---|---|
| 報告日 | 担当者名 | 事業全体ステータス | 今週の作業ステータス | 今週達成したタスク | 課題・リスク | 来週のタスク | その他 |

> ヘッダーは自動追加されるので、空シートのままでも動作します。

---

### Step 3 — Google Apps Script（GAS）のセットアップ

1. スプレッドシートを開き、**拡張機能 > Apps Script** を選択
2. `gas/コード.js` の内容を全てコピー&ペースト
3. **デプロイ > 新しいデプロイ**
   - 種類: `ウェブアプリ`
   - 実行ユーザー: `自分`
   - アクセスできるユーザー: `全員`
4. デプロイ後に表示される **URL をコピー**（後で使用）

> ⚠ コードを変更した場合は「新しいデプロイ」ではなく「デプロイを管理 > 編集 > バージョン新規作成」で更新すること

---

### Step 4 — Slack Bot の設定

**Slack Bot Token の取得:**

1. [https://api.slack.com/apps](https://api.slack.com/apps) → **Create New App** → **From scratch**
2. **OAuth & Permissions** → **Bot Token Scopes** に以下を追加:
   - `chat:write`
   - `files:write`
3. **Install to Workspace** → **Bot User OAuth Token** をコピー（`xoxb-` で始まる）

**チャンネルIDの確認:**

1. Slackでチャンネルを右クリック（またはチャンネル名をクリック）
2. **チャンネルIDをコピー**（例: `C0123456789`）
3. ボットをチャンネルに招待: チャンネルで `/invite @ボット名` を実行

---

### Step 5 — Gemini API キーの取得

1. [https://aistudio.google.com](https://aistudio.google.com) にアクセス
2. **「Get API key」** → **「Create API key」** をクリック
3. 表示されたキー（`AIza...`）をコピー（後で使用）

無料枠：1日1,500リクエスト・1分30リクエスト（週1回の実行では超えない）

---

### Step 6 — .env ファイルの作成

```bash
cp .env.example .env
```

`.env` を開き、以下を設定:

```ini
GAS_URL=https://script.google.com/macros/s/XXXXXXXXXX/exec
SLACK_BOT_TOKEN=xoxb-XXXXXXXXXXXX
SLACK_CHANNEL_ID=C0123456789
SURGE_DOMAIN=チーム名-progress
GEMINI_API_KEY=AIzaXXXXXXXXXX
```

---

### Step 7 — 依存パッケージのインストール

```bash
npm install
npx playwright install chromium
```

---

### Step 8 — GitHub Secrets の設定

GitHubリポジトリの **Settings > Secrets and variables > Actions** に以下を登録:

| Secret名 | 値 |
|----------|----|
| `GAS_URL` | GASのデプロイURL |
| `SLACK_BOT_TOKEN` | Slack Bot Token（xoxb-...） |
| `SLACK_CHANNEL_ID` | 投稿先チャンネルID |
| `GEMINI_API_KEY` | Gemini API キー（AIza...） |

---

## 毎週の使い方

### 担当者（毎週末）

1. 入力フォームURL（`https://rsan39improve.github.io/weekly-progress-dashboard/`）をブラウザで開く
2. 各項目を入力して「報告を送信する」をクリック
3. 「送信完了」が表示されれば完了

### 管理者（毎週月曜）

通常は **GitHub Actions が毎週月曜 朝8:00（JST）に自動実行**するため、手動操作は不要です。

手動でテストしたい場合は各スクリプトを順番に実行：

```bash
node scripts/fetch-sheets.js      # データ取得
node scripts/summarize.js         # AI要約生成
node scripts/generate-dashboard.js # HTML生成
node scripts/screenshot.js         # スクリーンショット撮影
node scripts/post-slack.js         # Slack投稿
```

または一括実行（Surge.shデプロイを含む）：

```bash
bash run.sh
```

---

## ファイル構成

```
weekly-progress-dashboard/
├── README.md                  ← この手順書
├── DESIGN.md                  ← 詳細設計書
├── package.json
├── .env.example               ← 設定テンプレート
├── .env                       ← 実際の設定（Git管理外）
├── run.sh                     ← ローカル手動実行スクリプト（6ステップ）
├── docs/
│   └── index.html             ← 入力フォーム（GitHub Pages で公開）
├── gas/
│   └── コード.js              ← GASに貼るコード（doGet + doPost）
├── scripts/
│   ├── fetch-sheets.js        ← スプレッドシートからデータ取得
│   ├── summarize.js           ← Gemini APIでAI要約生成
│   ├── generate-dashboard.js  ← HTMLカード・サマリーカード生成
│   ├── deploy.js              ← Surge.sh に公開（ローカルのみ）
│   ├── screenshot.js          ← プロジェクトカードごとに撮影
│   └── post-slack.js          ← Slack Bot APIで画像投稿
└── output/                    ← 生成ファイル（Git管理外）
    ├── data.json               ← 取得したプロジェクトデータ
    ├── summary.json            ← Geminiが生成したAI要約
    ├── dashboard.html          ← 生成されたダッシュボード
    ├── cards/                  ← プロジェクトカードHTML（_summary.htmlを含む）
    └── screenshots/            ← Slackに投稿する画像（_summary.pngを含む）
```

---

## トラブルシューティング

| エラー | 対処法 |
|--------|--------|
| `GAS_URL が設定されていません` | `.env` の `GAS_URL` を確認 |
| `SLACK_BOT_TOKEN が設定されていません` | `.env` の `SLACK_BOT_TOKEN` を確認 |
| `GEMINI_API_KEY が設定されていません` | `.env` の `GEMINI_API_KEY` を確認 |
| Gemini 429エラー（Too Many Requests） | 無料枠の上限。1日リセット後に再実行 |
| スクリーンショットが撮れない | `npx playwright install chromium` を再実行 |
| フォームを送信しても記録されない | GASのデプロイURLが正しいか確認 |
| GitHub Actionsがエラーになる | GitHub Secretsに全4項目が登録されているか確認 |

---

## 将来の移行計画

現在はGoogle スプレッドシート（試作版）。上司への提案・承認後に **Excelファイル（共有SMBサーバー）版**へ移行予定。変更が必要なのは `scripts/fetch-sheets.js` のみ（`xlsx` ライブラリに切り替え）。
