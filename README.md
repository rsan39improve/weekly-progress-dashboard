# 週次進捗ダッシュボード

チームメンバーが毎週末に入力した進捗を、月曜朝に自動でSlackへ画像レポートとして投稿するツールです。

---

## 全体の流れ

```
【毎週金曜】担当者がブラウザでフォームに入力
          ↓ Google Apps Script（GAS）でスプレッドシートに自動保存
【毎週月曜】bash run.sh を1回実行
  1. スプレッドシートからデータ取得
  2. HTMLダッシュボード + プロジェクトカード生成
  3. Surge.sh に公開（URL発行）
  4. カードごとにスクリーンショット撮影（Playwright）
  5. Slackにレポート画像を投稿（Slack Bot API）
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
   - 例: `Webサイトリニューアル` / `採用資料作成` / `社内研修動画制作`
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

### Step 4 — 入力フォームの設定

1. `output/mockup-form.html` をテキストエディタで開く
2. 先頭付近の `GAS_URL` を Step 3 で取得したURLに書き換える

```javascript
const GAS_URL = 'https://script.google.com/macros/s/XXXXXXXXXX/exec';
```

3. `select` タグのプロジェクト一覧を実際のプロジェクト名に書き換える

```html
<option>Webサイトリニューアル</option>
<option>採用資料作成</option>
```

4. HTMLファイルをチームメンバーに共有する（ファイルをダブルクリックでブラウザで開ける）

---

### Step 5 — Slack Bot の設定

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

### Step 6 — Surge.sh の設定

```bash
# Surge.sh のアカウント作成（初回のみ）
npx surge login
```

---

### Step 7 — .env ファイルの作成

```bash
cp .env.example .env
```

`.env` を開き、以下を設定:

```ini
GAS_URL=https://script.google.com/macros/s/XXXXXXXXXX/exec
SLACK_BOT_TOKEN=xoxb-XXXXXXXXXXXX
SLACK_CHANNEL_ID=C0123456789
SURGE_DOMAIN=チーム名-progress   # 例: myteam-progress
```

---

### Step 8 — 依存パッケージのインストール

```bash
npm install
npx playwright install chromium
```

---

## 毎週の使い方

### 担当者（毎週金曜）

1. `output/mockup-form.html` をブラウザで開く
2. 各項目を入力して「報告を送信する」をクリック
3. 「送信完了」が表示されれば完了

### 管理者（毎週月曜）

通常は **GitHub Actions が毎週月曜 朝8:00（JST）に自動実行**するため、手動操作は不要です。

手動で実行したい場合は以下のコマンドを使います：

```bash
bash run.sh
```

> **注意：** `run.sh` はローカル実行用のスクリプトです。Surge.sh へのデプロイ（Step 3）が含まれており、GitHub Actions のワークフローとは手順が異なります。Slack への投稿だけ確認したい場合は、Surge のステップでエラーが出ても後続の screenshot・post-slack は実行されません。その場合は各スクリプトを個別に実行してください：
>
> ```bash
> node scripts/fetch-sheets.js
> node scripts/generate-dashboard.js
> node scripts/screenshot.js
> node scripts/post-slack.js
> ```

---

## ファイル構成

```
weekly-progress-dashboard/
├── README.md                  ← この手順書
├── package.json
├── .env.example               ← 設定テンプレート
├── .env                       ← 実際の設定（Git管理外）
├── run.sh                     ← 毎週月曜に実行する1コマンド
├── gas/
│   └── コード.js              ← GASに貼るコード（doGet + doPost）
├── scripts/
│   ├── fetch-sheets.js        ← スプレッドシートからデータ取得
│   ├── generate-dashboard.js  ← HTMLダッシュボード + カード生成
│   ├── deploy.js              ← Surge.sh に公開
│   ├── screenshot.js          ← プロジェクトカードごとに撮影
│   └── post-slack.js          ← Slack Bot APIで画像投稿
└── output/                    ← 生成ファイル（Git管理外）
    ├── mockup-form.html        ← 入力フォーム（担当者が使う）
    ├── mockup-slack.html       ← Slackレポートのイメージ確認用
    ├── mockup-card.html        ← カードデザインの確認用
    ├── data.json               ← 取得したプロジェクトデータ
    ├── dashboard.html          ← 生成されたダッシュボード
    ├── cards/                  ← プロジェクトカードHTML（撮影用）
    └── screenshots/            ← Slackに投稿する画像
```

---

## トラブルシューティング

| エラー | 対処法 |
|--------|--------|
| `GAS_URL が設定されていません` | `.env` の `GAS_URL` を確認 |
| `SLACK_BOT_TOKEN が設定されていません` | `.env` の `SLACK_BOT_TOKEN` を確認 |
| Surge デプロイ失敗 | `npx surge login` でログインし直す |
| スクリーンショットが撮れない | `npx playwright install chromium` を再実行 |
| フォームを送信しても記録されない | GASのデプロイURLが正しいか確認、GASのログを確認 |

---

## 将来の移行計画

現在はGoogle スプレッドシート（試作版）。上司への提案・承認後に **Excelファイル（共有SMBサーバー）版**へ移行予定。変更が必要なのは `scripts/fetch-sheets.js` のみ（`xlsx` ライブラリに切り替え）。
