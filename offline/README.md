# Studyplus 単体オフラインHTML

`studyplus_offline.html` をダウンロードし、ChromeやEdgeなどのブラウザで開く。JavaScript・CSS・アイコンはすべて内蔵しており、ネット接続やサーバーは不要。

現在のサイトと同じ分析・入力・スマホ表示を利用する。学習データや認証情報はHTMLに埋め込まない。既存の記録はサイトで全データJSONを出力し、このHTMLの「データ・設定メニュー」からJSON読込する。

記録はHTMLファイルそのものではなく、ブラウザのIndexedDBに保存される。「データ・設定」の同じ画面にある「端末間の同期」に同じ非公開リポジトリと各端末のGitHubトークンを設定すると、GitHub Pagesと接続時に同期できる。Node.jsは不要。接続手順はSYNC_SETUP.mdを参照。未設定の場合は従来どおり端末内保存。ブラウザの保存領域削除やファイル移動、別の端末への移動に備えてJSONをバックアップする。JSONバックアップはHTMLとは別ファイル。

スマホのファイルプレビューではJavaScriptや保存が動作しない場合がある。ブラウザで開く必要があり、iPhone実機は未検証。

## 再生成

```sh
npm run build:offline
```

SitesやGitHub Pagesの公開設定・生成物は変更しない。共通の画面・計算とPages版の端末内保存処理を利用し、外部アセットをHTML内に埋め込む。

## 検証

同期を含むテスト7件、型チェック、生成スクリプトとブラウザテストのESLintが成功。

Chromiumで通信を無効にして、生成した単体HTMLの保存・再読込、競合、保存失敗時の入力保持、JSON往復、設定・科目色保持、削除、360/390/430/1280/1440pxの表示を確認。外部アセット・API通信なし。

このクラウド環境は `file://` 表示を禁止しているため、同じHTMLをメモリからローカルURLに返す方法で検証した。ファイル直接起動とiPhone実機は未確認。

```sh
STUDYPLUS_OFFLINE_TEST_FILE="$PWD/offline/studyplus_offline.html" \
STUDYPLUS_OFFLINE_TEST_URL=http://localhost:5177/studyplus_offline.html \
STUDYPLUS_PLAYWRIGHT_MODULE=/path/to/playwright-core/index.mjs \
node tests/pages.browser.mjs
```

ファイル直接起動が許可された環境では `STUDYPLUS_OFFLINE_TEST_URL` を省略すると `file://` で検証する。

ストップウォッチ・ポモドーロは「記録を追加」から利用できます。計測結果を保存してからHTMLを更新してください。詳しい手順は同梱のTIMER_GUIDE.mdを参照してください。

## 今日のホーム

今日の進捗・次の学習・科目と教材・最近の流れの4カードを表示する。「目標を設定」から日付別の目標を保存でき、未設定なら曜日別・週間目標からの目安を使う。目標は学習記録と同じJSON・端末間同期に含まれる。計測中の未保存時間は実績に加算しない。

GitHub同期を設定した最新版同士では計測状況も共有できます。別端末から操作するには計測画面の「この端末で操作する」を押します。通信なしでも操作端末の計測は続きます。計測あり15秒・なし30秒を目安に共有状態を確認するため、他端末の停止などには反映遅れがあります。競合時は未送信計測を保持します。詳しくは同梱TIMER_GUIDE.mdを参照してください。
