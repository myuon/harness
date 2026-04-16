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

スキルの呼び出し時に URL 引数が指定されているかどうかで、実行するコマンドが異なる。

**URL 引数なし**（ローカルの `~/.config/harness/manifest.json` を使う）:

```bash
curl -fsSL https://github.com/myuon/harness/releases/latest/download/harness-install.mjs | node --input-type=module
```

**URL 引数あり**（例: `/harness:install https://raw.githubusercontent.com/owner/repo/main/manifest.json`）:  
引数の URL を `HARNESS_MANIFEST_URL` 環境変数として前置してコマンドを実行する:

```bash
HARNESS_MANIFEST_URL=https://raw.githubusercontent.com/owner/repo/main/manifest.json curl -fsSL https://github.com/myuon/harness/releases/latest/download/harness-install.mjs | node --input-type=module
```

- URL が指定された場合: `HARNESS_MANIFEST_URL=<url>` を前置し、スクリプトがその URL から manifest JSON を取得して使う
- URL が指定されない場合: ローカルの `~/.config/harness/manifest.json` を読む

スクリプトが以下を自動で行い、結果を JSON で返す:
- マニフェスト（URL 指定時はリモート、省略時は `~/.config/harness/manifest.json`）の読み込み
- 判断記録（`.harness-decisions.json`）の読み込み
- インストール済みスキル一覧の取得
- `condition: "always"` かつ未インストールのスキルのインストール実行

### 2. needs_evaluation の処理

スクリプトの出力に `needs_evaluation` がある場合のみ、各エントリの condition をプロジェクトの実態を見て評価する:

- package.json の dependencies/devDependencies
- ディレクトリ構造やファイル拡張子
- フレームワーク設定ファイル

#### type: "skill" の場合

評価結果が `install: true` のスキルは以下を実行:
- `scope: "global"` → `npx skills add <source> --skill <name> -g -y`
- `scope: "project"`（デフォルト）→ `npx skills add <source> --skill <name> -y`

#### type: "profile" の場合

`needs_evaluation` に `type: "profile"` のエントリがある場合、profile 単位で condition を評価する:

- profile の condition を評価し `apply: true` なら、その profile 内の全スキルをインストールする
  - 各スキルの `scope` に従い `npx skills add <source> --skill <name> [-g] -y` を実行
- `apply: false` なら、その profile 内の全スキルをスキップする

判断結果は `decisions.profiles` に書き込む（スキルの判断は `decisions.skills` ではなく profile 側で管理）。

### 3. 判断記録の更新

`.harness-decisions.json` にすべての判断結果を書き込む（スクリプト結果 + needs_evaluation の評価結果を統合）。

### 4. サマリー表示

テーブル形式で表示（スキル名 / 結果 / 理由）。

## 注意

- condition 評価は推測ではなく実際にファイルを読んで行う
- 判断に迷ったらユーザーに確認する
- 既存の判断記録は上書きしない
- `scope` 省略時は `"project"`
