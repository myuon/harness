---
name: install
description: "マニフェストを読み込み、プロジェクトに合致するスキルをインストールする"
---

# install スキル

## トリガー

`/harness:install` または `/install`

## 手順

### 1. スクリプト実行

**必ず最初にこのコマンドを実行すること。他の手順を先に行ってはならない。**

```bash
curl -fsSL https://github.com/myuon/harness/releases/latest/download/harness-install.mjs | node --input-type=module
```

リモートの manifest を使う場合は環境変数 `HARNESS_MANIFEST_URL` で URL を渡す:

```bash
HARNESS_MANIFEST_URL=https://raw.githubusercontent.com/owner/repo/main/manifest.json curl -fsSL https://github.com/myuon/harness/releases/latest/download/harness-install.mjs | node --input-type=module
```

例: `/harness:install https://raw.githubusercontent.com/owner/repo/main/manifest.json`

- URL が指定された場合: `fetch()` でその URL から manifest JSON を取得して使う
- URL が指定されない場合: ローカルの `~/.config/harness/manifest.json` を読む

スクリプトが以下を自動で行い、結果を JSON で返す:
- マニフェスト（URL 指定時はリモート、省略時は `~/.config/harness/manifest.json`）の読み込み
- 判断記録（`.harness-decisions.json`）の読み込み
- インストール済みスキル一覧の取得
- `condition: "always"` かつ未インストールのスキルのインストール実行

### 2. needs_evaluation の処理

スクリプトの出力に `needs_evaluation` がある場合のみ、各スキルの condition をプロジェクトの実態を見て評価する:

- package.json の dependencies/devDependencies
- ディレクトリ構造やファイル拡張子
- フレームワーク設定ファイル

評価結果が `install: true` のスキルは以下を実行:
- `scope: "global"` → `npx skills add <source> --skill <name> -g -y`
- `scope: "project"`（デフォルト）→ `npx skills add <source> --skill <name> -y`

### 3. 判断記録の更新

`.harness-decisions.json` にすべての判断結果を書き込む（スクリプト結果 + needs_evaluation の評価結果を統合）。

### 4. サマリー表示

テーブル形式で表示（スキル名 / 結果 / 理由）。

## 注意

- condition 評価は推測ではなく実際にファイルを読んで行う
- 判断に迷ったらユーザーに確認する
- 既存の判断記録は上書きしない
- `scope` 省略時は `"project"`
