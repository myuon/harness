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
- プラグインの分類・インストール・更新（`plugins_installed`, `plugins_updated`, `plugins_already_installed`, `plugins_needs_evaluation`, `plugins_skipped_by_decision`）

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

#### プラグインの needs_evaluation

`plugins_needs_evaluation` にエントリがある場合、各プラグインの condition をプロジェクトの実態を見て評価する:

- 評価結果が `install: true` のプラグインは `claude plugins install <name> -s <scope>` を実行
- `install: false` のプラグインはスキップする

#### プラグインのバージョン指定について

| manifest の `version` 値 | 動作 |
|--------------------------|------|
| 省略（フィールドなし）   | 常に最新へ更新（`toUpdate` に分類、`claude plugins update` を使用） |
| `"latest"`               | 常に最新へ更新（`toUpdate` に分類、`claude plugins update` を使用） |
| 具体的なバージョン文字列 | インストール済みバージョンと一致 → `alreadyInstalled`、異なる → `toUpdate` |

- 新規インストール（未インストール）は常に `claude plugins install <name> -s <scope>` を使用
- 更新（インストール済み）は常に `claude plugins update <name> -s <scope>` を使用
- 具体的なバージョンを指定した場合、`claude plugins update` は最新版をインストールするため、バージョンフィールドは「同期トリガー」として機能する（マニフェストのバージョンと異なる場合に更新を発動させる）

### 3. 判断記録の更新

`.harness-decisions.json` にすべての判断結果を書き込む（スクリプト結果 + needs_evaluation の評価結果を統合）。

- スキルの判断は `decisions.skills` に書き込む
- プロファイルの判断は `decisions.profiles` に書き込む
- プラグインの判断は `decisions.plugins` に書き込む

### 4. サマリー表示

テーブル形式で表示（スキル名 / 結果 / 理由）。プラグインの結果も含める:
- `plugins_installed`: インストールされたプラグイン
- `plugins_updated`: 更新されたプラグイン
- `plugins_already_installed`: 既にインストール済みのプラグイン
- `plugins_needs_evaluation`: 条件評価が必要だったプラグイン
- `plugins_skipped_by_decision`: スキップされたプラグイン

## 注意

- condition 評価は推測ではなく実際にファイルを読んで行う
- 判断に迷ったらユーザーに確認する
- 既存の判断記録は上書きしない
- スキルの `scope` 省略時は `"project"`
- プラグインの `scope` 省略時は `"user"`
