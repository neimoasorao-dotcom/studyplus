# Studyplus 単体オフラインHTML

`studyplus_offline.html` をダウンロードし、ChromeやEdgeなどのブラウザで開く。JavaScript・CSS・アイコンはすべて内蔵しており、ネット接続やサーバーは不要。

現在のサイトと同じ分析・入力・スマホ表示を利用する。学習データや認証情報はHTMLに埋め込まない。既存の記録はサイトで全データJSONを出力し、このHTMLの「データ・設定メニュー」からJSON読込する。

記録はHTMLファイルそのものではなく、ブラウザのIndexedDBに保存される。GitHub Pagesとは自動同期しない。ブラウザの保存領域削除やファイル移動、別の端末への移動に備えてJSONをバックアップする。JSONバックアップはHTMLとは別ファイル。

スマホのファイルプレビューではJavaScriptや保存が動作しない場合がある。ブラウザで開く必要があり、iPhone実機は未検証。

## 再生成

```sh
npm run build:offline
```

SitesやGitHub Pagesの公開設定・生成物は変更しない。共通の画面・計算とPages版の端末内保存処理を利用し、外部アセットをHTML内に埋め込む。

## 検証

既存テスト5件、型チェック、生成スクリプトとブラウザテストのESLintが成功。

Chromiumで通信を無効にして、生成した単体HTMLの保存・再読込、競合、保存失敗時の入力保持、JSON往復、設定・科目色保持、削除、360/390/430/1280/1440pxの表示を確認。外部アセット・API通信なし。

このクラウド環境は `file://` 表示を禁止しているため、同じHTMLをメモリからローカルURLに返す方法で検証した。ファイル直接起動とiPhone実機は未確認。

```sh
STUDYPLUS_OFFLINE_TEST_FILE="$PWD/offline/studyplus_offline.html" \
STUDYPLUS_OFFLINE_TEST_URL=http://localhost:5177/studyplus_offline.html \
STUDYPLUS_PLAYWRIGHT_MODULE=/path/to/playwright-core/index.mjs \
node tests/pages.browser.mjs
```

ファイル直接起動が許可された環境では `STUDYPLUS_OFFLINE_TEST_URL` を省略すると `file://` で検証する。
