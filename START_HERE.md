# Studyplus 学習分析・開発引き継ぎ

Sites公開版のソースコード一式です。白・グレー中心の最新配色を含みます。

## GitHubへの登録
ZIPを解凍し、studyplus-sourceフォルダの中身をリポジトリ直下へ登録してください。node_modules、秘密情報、ユーザーの学習記録は含めていません。

## 主なファイル
- app/page.tsx：画面・操作
- app/globals.css：配色・レイアウト・レスポンシブ設定
- lib/：分析、JSON読込、保存処理
- SPECIFICATION.md：仕様
- IMPLEMENTATION.md：実装の説明
- tests/：検証
- offline/studyplus_offline.html：単体で開けるオフライン版

## Codexへの作業方針
PCのデザインと操作性を維持し、スマホのデザイン・操作性のみ改善する。機能・分析ロジック・データ形式を勝手に省略しない。実装前にコードを調査する。

## 注意
ソースはSites向けの認証・Cloudflare D1・Worker構成を含みます。GitHubに登録するだけでは現在のSitesへの自動公開や保存データの移行は行われません。公開先の変更は別作業です。
開発の詳細はREADME.md、依存関係はpackage.jsonとpnpm-lock.yamlを参照してください。
オフライン版は別のビルド成果物のため、appの修正がHTMLに自動反映される構成にはなっていません。
