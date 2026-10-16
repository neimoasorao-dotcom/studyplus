# 統合デザイン：Flow Desk / Insight Lab / Subject Studio

2026-10-16（日本時間）。基準は `bbfdfe2`。案2のホームとナビ、案3の分析、案6の教材操作を統合。本番データ、同期先、認証方式の移行はありません。

## 画面と導線

| 領域 | 構成 |
|---|---|
| ホーム | 今日の実績・直接目標・週間進捗と、科目／教材選択・開始を一つの面に統合。下段は7日グラフと今日の科目。昨日までの平均はグラフの点線で併記 |
| 学習 | 科目フィルター、教材検索・保存済み並び順、教材詳細。PCは一覧／詳細の2ペイン、スマホは一覧から詳細へ。教材を引き継いで計測・手入力を開始 |
| 分析 | 時間／週間・目標／長期／科目／総合／配分／安定性。期間、概要、推移、詳細の階層で全指標を保持。表は領域内スクロール |
| 記録 | 全記録を検索、30件単位で表示、編集・確認付き削除。今日・教材・科目を引き継ぐリンク |
| 学習管理 | 目標、模試、AI分析、科目・教材設定、JSON・同期、表示・計算設定 |

メインナビはPC・スマホとも5項目。スマホの開始ドックは下部ナビとセーフエリアを避けます。ページ内切替はスクロールを操作しません。ブラウザの戻る操作と教材一覧への戻りでは位置を復元します。

選んだホームの科目・教材と入力下書きは、アプリ内の画面移動・記録方法切替で保持します。開始方法は端末の表示設定に保存。計測は既存の単一コントローラーを利用し、画面遷移・幅変更で再作成しません。

## 構造

- `styles/tokens.css`：意味別の色、タイマーの青／緑、余白、角丸、影。ライト・ダーク。
- `styles/workspace.css`：共通シェル、ホーム、教材、分析、管理、入力、レスポンシブ。スマホは既存境界767px以下。
- `components/layout/app-shell.tsx`：5項目ナビ、ヘッダー、同期状態、計測の表示先。
- `hooks/use-app-navigation.ts` / `lib/navigation.ts`：既存ハッシュ互換、対象のクエリ、スクロール復元。
- `components/data/presentation.tsx`：従来の数値、表、チャート、期間、サマリー部品。
- `components/analysis/views.tsx`：既存分析画面を計算式ごと移設。分析分類は `analysis-navigation.tsx`。
- `components/study/`：教材の一覧・詳細、共通科目／教材選択、開始操作。
- `components/management/views.tsx`：模試・AI・設定の既存画面。`management-home.tsx` は入口。
- `components/study-recorder.tsx`：既存計測／同期処理に開始要求と保持する手入力下書きを接続。
- `app/page.tsx`：保存・インポート・リビジョン・同期・各画面を接続。

React/Vite/Rechartsを継続し、依存追加はありません。既存の共有部品用CSSは `app/globals.css` に残しています。保存コントローラーを同時に大規模分割する変更はしていません。

## データ互換性

`lib/analysis.ts`、記録検証、保存アダプター、同期マージ、共有タイマーのプロトコルは変更しません。スキーマ1.0、IndexedDB名・キー、リビジョン、GitHub同期ファイル、ユーザーの色、並び順、原情報・未知フィールドを維持します。新しい保存形式への移行は不要です。

目標未設定時の曜日／週間の目安、今日を含む残り日数、週境界、保存済み実績への計測中時間の非加算も維持します。ページ描画や切替で学習データを書き込みません。未保存データを破棄して再読込する操作は確認後、読込成功時のみ保留状態を解除します。

## 検証

すべて合成データと新規ブラウザコンテキストを使用。実学習データ・実同期リポジトリへの書込はしません。

- `node --test tests/*.test.mjs`：計算、JSON、記録、保存、並び順、同期、計測、ホーム、空／有データの描画。
- `npx tsc --noEmit`、`npm run build:pages`、`npm run build:offline`、`npm run build`。
- `unified-workspace.browser.mjs`：360/375/390/430/768/1050/1280/1440px × 15画面。はみ出し、開始ボタン、切替、対象の引継ぎ、下書き、JSON、データ不変。
- `pages.browser.mjs`：IndexedDB、リロード、タブ競合、容量不足、JSON往復、設定、削除。
- `today-home.browser.mjs`：直接目標、曜日／週目標の目安、日付跨ぎ、計測の非二重計上。
- `recorder-selection.browser.mjs` / `record-management.browser.mjs`：ダークの選択欄、科目絞込、ドラッグ順序、色のプレビュー／取消／保存、記録編集・削除、原情報保持。
- `color-mode.browser.mjs`：ライト／ダーク／システム、コントラスト、端末設定追従、キーボード、別タブ、小窓。
- `timer.browser.mjs` / `timer-pip.browser.mjs` / `shared-timer.browser.mjs`：計測、休憩、保存、破棄、復元、表示位置、小窓、模擬GitHubへの共有・操作権移譲・競合。
- `sync.browser.mjs`：模擬GitHubで初回同期、オフライン追記、競合の保持、解除、秘密情報除外。

旧 `mobile.browser.mjs` / `mobile-review.browser.mjs` / `compact-mobile.browser.mjs` は旧ナビ・旧配置の比較用履歴です（旧PC配置の完全一致など、今回の刷新と両立しない条件を含む）。今回のレスポンシブ基準は上記の統合ワークスペース・計測・配色・保存テストです。

オフラインHTMLは別途生成し、ネットワーク無効のブラウザで検証。管理環境の制限により `file://` ではなくHTMLをメモリからローカルURLに配信しています。実機iPhoneのキーボード・セーフエリア、Windows Chromeでのファイル直開きは未確認です。

## 公開

既存の main/root GitHub Pages を使用。`npm run prepare:pages` の成果物と `offline/studyplus_offline.html` を同じ変更に含め、mainへのマージによる自動公開を利用。Sitesへの公開は行いません。

公開確認はPagesのビルド対象コミットと成功状態、公開HTMLが参照するCSS/JS、オフラインHTMLの内容を確認します。学習データを利用するための同期設定やブラウザ保存領域は変更しません。

[PC・スマホの実画面](ui-preview/README.md)

## UI密度の調整

2026-10-16：PC・スマホの文字、余白、操作部品をコンパクト化。[同条件の変更前後と測定値](ui-density/README.md)。学習データ・計算・同期の変更はありません。
