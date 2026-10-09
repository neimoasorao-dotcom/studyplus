# GitHub Pages版

公開URL: https://neimoasorao-dotcom.github.io/studyplus/

## 記録の保存と移行

ユーザー承認済みの構成: 認証なし、学習記録は各端末・ブラウザのIndexedDB内に保存。記録の送信先サーバーはなく、他の訪問者には自分の記録は表示されない。SitesのD1データとは別の保存先で、自動移行・同期はしない。

Sitesから移す場合は、Sitesの設定から全データをJSON出力し、このサイトの「データ・設定」→「JSONを読み込む」で取り込む。科目色・教材・目標・記録の形式と計算は共通。既存のSitesデータは変更しない。

同じ端末・ブラウザでは再読込後も保持。別の端末/ブラウザへの移動には全データJSON出力・読込を使用する。ブラウザのサイトデータ消去やプライベート閲覧の終了で消える場合があるため、JSONを定期的にバックアップする。保存に失敗した場合は入力・未保存JSONを保持し、暗黙の上書きはしない。

## ビルドと公開

既存のPages設定（mainブランチのルート、Jekyll）を利用。Pages設定の変更権限は不要で、mainへの更新後にGitHubの既存Pagesワークフローが公開する。

Node 24とpackage.jsonで指定したpnpm 11.25.0を使用。

```sh
corepack pnpm install --frozen-lockfile
node --test tests/*.test.mjs
corepack pnpm exec tsc --noEmit
npm run build:pages
npm run prepare:pages
```

ソース変更と生成された `index.md` / `pages-assets/` / `favicon.svg` を同じPRでコミット・マージする。GitHub Actionsの「pages build and deployment」の成功を確認する。`dist-pages/`、node_modules、ローカル保存データはコミットしない。

`index.md`は公開時にindex.htmlになる。開発用リポジトリのルートにindex.htmlを置かないため、既存のVite/Vinext起動時にPages版がSites版を隠す問題を避ける。`scripts/prepare-pages.mjs`はPages用生成物だけを更新する。

Pages版は同じ `app/page.tsx` とCSSを利用し、`vite.pages.config.ts` のビルド時aliasで保存用モジュールだけを差し替える。Sites版の `npm run dev` / `npm run build` と `/api/state` / D1構成は維持。オフラインHTMLは別成果物で、今回の公開には使用していない。

## 検証

- 既存5テスト、型チェック、SitesビルドとPagesビルドが成功。
- `tests/pages.browser.mjs`: 実IndexedDBによる保存/再読込、複数タブの競合検出、容量不足時の入力保持、JSON往復、設定/科目色保持、削除後の設定保持、360/390/430/1280/1440pxの表示を確認。サーバー保存APIへ通信しないことも確認。
- 検証にはローカルの隔離されたブラウザとテストデータのみを使用。

```sh
node node_modules/vite/bin/vite.js preview --config vite.pages.config.ts --host 127.0.0.1 --port 5176
# 別ターミナル。既存のPlaywright CoreとChromiumを指定。
STUDYPLUS_PLAYWRIGHT_MODULE=/path/to/playwright-core/index.mjs \
STUDYPLUS_CHROMIUM=/path/to/chromium node tests/pages.browser.mjs
```
