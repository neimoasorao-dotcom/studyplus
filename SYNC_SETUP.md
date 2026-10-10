# GitHub非公開リポジトリによる端末間同期

PCへのNode.jsインストールやCloudflareの作成は不要。公開サイトとPCの単体HTMLがGitHub APIで非公開のJSONを読み書きする。未設定の場合は従来の端末内保存を維持する。

保存先: `neimoasorao-dotcom/studyplus-data` / ブランチ: `main` / ファイル: `studyplus-sync.json`。2026-10-10時点で非公開・main・READMEの存在を確認済み。検証データを書き込まず、実際の初回ファイル作成は端末の接続後に行う。

## 1. 両端末のバックアップ

iPhoneとPCの「データ・設定」から全データをJSON出力する。PC用HTMLの更新前に必ず保存する。ファイルの場所やブラウザが変わると保存領域も変わる場合があるため、空になった場合はこのJSONを読み込んでから接続する。

## 2. GitHubトークンの作成（ブラウザだけ）

GitHubのSettings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new tokenを開く。PC用とiPhone用を別々に作成すると、片方だけ解除できる。

- Token name: studyplus-sync-pc / studyplus-sync-iphone
- Expiration: 管理できる期限を指定（例:90日）
- Resource owner: neimoasorao-dotcom
- Repository access: Only select repositories → studyplus-dataだけ
- Repository permissions: Contents → Read and write
- MetadataのReadは自動で付く。他の権限は不要。

Generate tokenを押し、github_pat_から始まる値をパスワードマネージャーなどに保存する。通常、全体は生成直後しか表示されない。トークンをチャットや公開リポジトリへ貼らない。サイト用の公開リポジトリにアクセスする権限も不要。

## 3. 各端末の設定

1. iPhoneは https://neimoasorao-dotcom.github.io/studyplus/ を再読込する。
2. PCは最新版のoffline/studyplus_offline.zipをダウンロード・解凍しHTMLを開く。更新前にバックアップし、記録が空の場合はJSONを読み込む。
3. 「データ・設定」→「端末間の同期」を開く。PCでは期間表示の「このブラウザに保存 · JSONでバックアップ」ボタンからも開ける。
4. 同期方式は「GitHub非公開リポジトリ（Node不要）」を選ぶ。
5. 保存先リポジトリはneimoasorao-dotcom/studyplus-data、ブランチはmain。
6. その端末用のGitHubトークンを入力し、「接続して同期を開始」を押す。
7. まずiPhoneで「同期済み」を確認し、次にPCも接続する。競合した場合は双方のJSONをバックアップし、表示された違いを確認する。

GitHubにログインしているだけではAPIの読み書きはできないため、両端末のトークン設定が必要。CloudflareのAPI URL・共有キーやNode/npmの操作は不要。以前Cloudflareへ接続済みの場合は一度「この端末の同期を解除」を押し、GitHub方式へ切り替える。解除は学習記録を削除しない。

## 4. 確認と日常利用

通常の記録を一件追加し、iPhoneとPCで「今すぐ同期」を押して同じ記録があるか確認する。ページ上部に同期状態と最終同期時刻を表示し、表示を押すと同期設定を開ける。「同期済み」は最後の通信・統合が成功した状態。閉じている別端末の状態を保証する表示ではない。以後は起動時・変更後・接続復帰・ウィンドウの再表示と30秒ごとに自動同期。入力中・未保存データがある間は待機し、オフラインでも端末内に保存する。次回接続時に反映する。

別々の記録追加と異なる設定項目の変更は統合する。同じ記録・設定の異なる編集や削除と編集の競合は上書きせず停止し、両方の値と共有側JSONの出力を提供する。現在の追加読込は同じsource_idを上書きしないため、記録の競合は内容に応じて個別整理が必要。

トークンは各ブラウザの同期設定用IndexedDBにだけ保存し、学習データJSON・HTML・公開コードには含めない。期限切れ・失効の場合は同期を解除して新しいトークンを設定する。同期失敗中も端末内保存は利用できる。

## 保存方式と注意点

非公開設定を読込時と書込直前に確認する。公開されたリポジトリには送信しない。GitHub APIのファイルSHAを使って、別端末の更新を古い内容で上書きしない。大きなファイルは認証付きGit Blobs APIで読む。学習Dataの形式は維持し、共有ファイルは `{sync_version:1,revision:数値,data:学習Data}` の内部形式で保存する。共有JSONを直接編集せず、通常はサイトを使う。

GitHubのコミット履歴には削除前の記録も残る。サイトの削除は現在の共有JSONへの反映であり、過去のコミットを消す処理ではない。無変更の同期は新しいコミットを作らない。初回接続は手元のデータも送信するため、保存先を確認する。

## 検証範囲

テストデータによるGitHub API模擬環境で、SHA競合、初回作成、公開リポジトリ拒否、UTF-8と1MB超の読込、無効トークン・権限エラーを確認。隔離した二つの実ブラウザで、オフライン追加・再接続・統合、競合時の両方保持、トークンのJSON除外、切断後のデータ保持を確認する。

本番のトークンは取得・入力していないため、実際のGitHub書込と本番二端末同期は各端末の設定後に確認が必要。file://直接起動は環境ポリシーで禁止されており、単体HTMLはlocalhostで検証。iPhone実機は未確認。学校PCからAPI通信が失敗する場合は、GitHubの権限・ネットワーク設定を確認する。

Cloudflare方式を既に使用している場合の手順はCLOUDFLARE_SYNC_SETUP.mdを参照。Studyplusアプリからの記録取得の自動化はこの同期とは別。
