# スマホ改善の検証

比較基準は作業開始時点の main (`e573344`)。検証はローカルChromium、同一のテストデータ・Asia/Tokyo・固定日時・表示幅・reduced motionで実施。本番の記録は変更していない。

## 画面と操作

- 360/390/430px: ホーム、学習時間、科目、教材、週、Condition、Balance、Stability、長期、目標、模試、AI。ページ内の全切替と詳細展開でページ全体の横はみ出しがないこと、末尾の情報が下部ナビで隠れないことを確認。
- 1280/1440px: 同じ12画面の全ページ画像・パネル位置/寸法・数値・文字サイズが修正前と一致。PCではスマホ用切替/補助メニューが表示されない。
- 教材の初期表示は390pxでページ高1239px→920px、430pxで1220px→900px（ブラウザの高さは900px）。主要指標・短いグラフ・教材を引き継ぐ記録ボタンを概要にまとめた。全期間グラフ・全指標・記録は他の切替先に残る。
- 教材切替、並び順/選択維持/localStorage保存、教材・科目の手入力への引き継ぎ、連続入力、保存失敗時の入力保持、保存/再読込を確認。
- JSON出力→同じJSONを読込→重複追加なし、設定保存で科目色/目標/既存記録を保持、テストデータの削除で科目/教材/目標を保持。
- メニューをキーボードで開き、ページ内切替を矢印/Home/Endキーで操作。教材切替後の概要/スクロール位置を確認。
- 空データ、長い科目/教材名、目標未設定、1000件以上の記録でも各ページ/切替先を確認。

## 自動チェック

ブラウザの276チェックが成功。Node 24で既存テスト5ファイル（画面描画22ケースを含む）、型チェック、ビルドに成功。新しいブラウザテスト/共通コンポーネントのESLintに成功。全体のESLintには既存の180エラー・3警告があり、基準コードでも同数を確認。全体lintでは依存キャッシュを対象外にする必要がある。

```sh
node --test tests/*.test.mjs
node node_modules/typescript/bin/tsc --noEmit
npm run build
node node_modules/eslint/bin/eslint.js components/mobile-analysis.tsx tests/mobile.browser.mjs
```

任意のブラウザ検証には既存のPlaywright/Playwright CoreとChromiumを使用（依存ライブラリは追加していない）。Node 24を使用する。

```sh
npm run dev -- --port 5173
# 別のターミナルで。モジュール・ブラウザのパスは環境に合わせる。
STUDYPLUS_PLAYWRIGHT_MODULE=/path/to/playwright-core/index.mjs \
STUDYPLUS_CHROMIUM=/path/to/chromium node tests/mobile.browser.mjs
```

ブラウザテストはlocalhost/127.0.0.1のみを許可し、全`/api/state`通信をテスト用の状態/保存失敗/競合応答に置換する。結果とJSON往復の成果物は `/tmp/studyplus-browser-results`。保存ハンドラー/D1バッチの挙動は既存の `storage.test.mjs` で別途検証。

## 実機で未確認の範囲

Chromiumで入力中に画面高450pxへ縮小し、入力シートが画面内に収まり、スクロールして保存/閉じる操作ができることを確認。iPhone Safari実機でのソフトキーボード、セーフエリア、VoiceOverの実際の挙動は未確認。CSSのsafe-area対応とvisualViewportへの追従を実装したことと、実機での確認は区別する。

オフラインHTMLとSites公開は対象外。GitHubへの反映をSites公開の完了とは扱わない。
