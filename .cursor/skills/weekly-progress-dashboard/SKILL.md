---
name: weekly-progress-dashboard
description: 週次プロジェクト進捗管理ツールの設計仕様と実装ガイド。入力フォーム・Slackレポート・HTMLダッシュボードの構成、承認済みデザイン、技術スタックを記録する。このプロジェクトへの変更・追加・実装の際に参照する。
---

# weekly-progress-dashboard — 設計仕様（最終更新：2026年4月）

## ツールの概要

チームメンバーが毎週末に進捗を入力し、月曜朝に自動でSlackへ画像レポートを投稿する進捗管理ツール。

```
【毎週末】担当者 → 入力フォーム（ブラウザ・スマホ対応）
              ↓ Google Apps Script（GAS）でスプレッドシートに自動保存
【月曜 8:00 JST】GitHub Actions が自動起動（PC不要・完全自動）
   ① スプレッドシートからデータ取得（直近8日以内のみ）
   ② HTMLダッシュボード + プロジェクトカード生成
   ③ Playwright でカードをスクリーンショット撮影
   ④ Slack Bot API でカード画像を投稿
```

---

## 実装状況（Phase 1 完了）

### ✅ 実装済み

| 機能 | 実装場所 |
|------|----------|
| 入力フォーム（GitHub Pages で公開） | `docs/index.html` |
| GAS によるデータ保存（doPost） | `gas/コード.js` |
| GAS によるデータ配信（doGet） | `gas/コード.js` |
| データ取得・直近8日フィルタリング | `scripts/fetch-sheets.js` |
| カードHTML・ダッシュボード生成 | `scripts/generate-dashboard.js` |
| Playwright スクリーンショット撮影 | `scripts/screenshot.js` |
| Slack Bot API 画像投稿 | `scripts/post-slack.js` |
| GitHub Actions 月曜自動実行 | `.github/workflows/weekly-report.yml` |

### 🔜 未実装（今後対応）

| 機能 | 優先度 |
|------|--------|
| 金曜リマインダー通知 | 高 |
| 未提出者の検知 | 高 |
| AI要約・管理者コメント（Gemini） | 中 |
| ルールベーススコアリング | 中 |
| 月次サマリー | 低 |

---

## 入力フォームの仕様

### 公開URL

```
https://rsan39improve.github.io/weekly-progress-dashboard/
```

### フィールド一覧

| # | フィールド名 | 種別 | 必須 |
|---|------------|------|------|
| 1 | 担当者名 | テキスト | 必須 |
| 2 | 担当プロジェクト名 | プルダウン | 必須 |
| 3 | 事業全体の進捗状況 | 3択ボタン | 必須 |
| 4 | 今週の作業ステータス | 3択ボタン | 必須 |
| 5 | 今週達成したタスク | 自由記述 | 必須（required属性あり） |
| 6 | 事業の課題・リスク | 自由記述 | 任意 |
| 7 | 来週のタスク | 自由記述 | 必須（required属性あり） |
| 8 | その他気になっている点 | 自由記述 | 任意 |

### ステータス選択肢（3択・共通）

- 🟢 **順調** — 問題なく進んでいる
- 🟡 **停滞** — 少し遅れているが対処中
- 🔴 **危険** — 上司・チームに判断を仰ぎたい

### デザイン方針

- ステータスはタップしやすい**大きなカード型ボタン**
- 課題欄は**薄赤背景**で書き漏れを防ぐ
- 所要時間の目安「3〜5分」を表示して心理的ハードルを下げる
- スマートフォンでも入力しやすいレイアウト
- 入力タイミングは「毎週末退勤前」（金曜祝日にも対応）

---

## Slack投稿の仕様

### 投稿タイミング

毎週月曜日 8:00 JST（GitHub Actions cron: `0 23 * * 0`）

### 投稿内容の構成

1. **サマリーメッセージ** — 日付・全体ステータス・順調/停滞/危険の件数
2. **プロジェクトカード画像** — 危険 → 停滞 → 順調 の順に投稿
   - 画像には：担当者・ステータス・今週のタスク・課題・来週のタスクを表示
   - 改行・箇条書きはそのまま画像に反映される（`\n` → `<br>` 変換済み）
   - 画像がない場合はテキストにフォールバック
3. **投稿結果** — 成功・失敗件数を最後にターミナルに表示

### Slack認証方法

- `SLACK_BOT_TOKEN`（xoxb-...）を GitHub Secrets に登録
- `@slack/web-api` の `WebClient` を使用
- 画像投稿は `files.uploadV2`、テキストは `chat.postMessage`

---

## 技術スタック

| 役割 | 技術 |
|------|------|
| 入力フォーム | 静的HTML（Tailwind CSS CDN + Lucide Icons） |
| フォーム公開 | GitHub Pages（`docs/index.html`） |
| データ保存 | Google スプレッドシート + Google Apps Script |
| データ取得 | Node.js（fetch + GAS doGet） |
| カード・ダッシュボード生成 | Node.js（HTMLテンプレート文字列） |
| スクリーンショット | Playwright / Chromium |
| Slack投稿 | Slack Bot API（`@slack/web-api`） |
| 自動実行 | GitHub Actions（cron） |
| 環境変数管理 | `.env`（ローカル） / GitHub Secrets（CI） |

---

## ファイル構成

```
weekly-progress-dashboard/
├── README.md                  ← セットアップ手順書（ユーザー向け）
├── DESIGN.md                  ← 詳細設計書（開発者向け）
├── package.json
├── .env.example               ← 設定テンプレート
├── .env                       ← 実際の設定（Git管理外）
├── run.sh                     ← ローカル手動実行スクリプト（CI と手順が異なる）
├── docs/
│   └── index.html             ← 入力フォーム（GitHub Pages で公開）
├── gas/
│   └── コード.js              ← Google Apps Script（doGet / doPost）
├── scripts/
│   ├── fetch-sheets.js        ← GASからデータ取得・8日フィルタリング
│   ├── generate-dashboard.js  ← HTMLカード・ダッシュボード生成
│   ├── deploy.js              ← Surge.sh 公開（ローカルrun.sh用・CIでは未使用）
│   ├── screenshot.js          ← Playwright スクリーンショット
│   └── post-slack.js          ← Slack Bot API 画像投稿
├── output/                    ← 生成ファイル（Git管理外）
│   ├── data.json              ← GASから取得したデータ
│   ├── dashboard.html         ← ダッシュボードHTML
│   ├── cards/                 ← プロジェクトカードHTML
│   └── screenshots/           ← カードのスクリーンショット
└── .github/
    └── workflows/
        └── weekly-report.yml  ← GitHub Actions ワークフロー
```

---

## 環境変数

| 変数名 | 説明 | 設定場所 |
|--------|------|----------|
| `GAS_URL` | GAS doGet/doPost のURL | `.env` / GitHub Secrets |
| `SLACK_BOT_TOKEN` | Slack Bot Token（xoxb-...） | `.env` / GitHub Secrets |
| `SLACK_CHANNEL_ID` | 投稿先チャンネルID（C...） | `.env` / GitHub Secrets |
| `SURGE_DOMAIN` | Surge.sh ドメイン（ローカルのみ使用） | `.env` のみ |

---

## 変更時の注意

- ステータスの選択肢は**順調・停滞・危険**の3択で統一する（「注意」「停止」は使わない）
- フォームのフィールドを変える場合は `gas/コード.js`・`scripts/fetch-sheets.js`・`docs/index.html` を同時に更新する
- `docs/index.html` を変更した場合は GitHub に push するだけで GitHub Pages に自動反映される
- ローカルの `run.sh` は Surge.sh デプロイを含むため CI と手順が異なる。Slack投稿だけ確認したい場合は各スクリプトを個別実行する
- `output/` フォルダは `.gitignore` で管理外（生成物のため）

---

## 将来の拡張方針

- **AI要約（Gemini）**: `data.json` 取得後に `scripts/summarize.js` を追加して挟む
- **金曜リマインダー**: GASの時間トリガー または 別のGitHub Actionsワークフローで対応
- **未提出検知**: マスターシート（全プロジェクト一覧）との照合が必要
