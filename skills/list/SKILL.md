---
name: list
description: manifest の内容を表示
---

## 概要

`~/.config/harness/manifest.json` の内容を読み込み、登録済みのスキルとプロファイルを一覧表示する。プロジェクトに `.harness-decisions.json` がある場合は、各エントリのインストール状態も合わせて表示する。

## 手順

### 1. manifest を読み込む

`~/.config/harness/manifest.json` を読み込む。

ファイルが存在しない場合:
- ユーザーに「manifest が見つかりません」と伝える
- `/harness:add` または `/harness:sync` を実行するよう提案して終了する

### 2. スキル一覧を表示する

manifest の `skills` セクションを以下の形式で表示する:

```
## スキル

- <name>
  - source: <source>
  - condition: <condition>
```

スキルが登録されていない場合は「スキルは登録されていません」と表示する。

### 3. プロファイル一覧を表示する

manifest の `profiles` セクションを以下の形式で表示する:

```
## プロファイル

- <name>
  - condition: <condition>
  - hooks: <hook 数> 件
    - <event> / <matcher>: <command>
    - <event> / <matcher>: <command>
    ...
```

各フックはイベント・matcher・コマンドをすべて表示すること。

プロファイルが登録されていない場合は「プロファイルは登録されていません」と表示する。

### 4. インストール状態を表示する（任意）

プロジェクトルートに `.harness-decisions.json` が存在する場合、各スキル・プロファイルのエントリに対してインストール状態を付記する。

判定ルール:
- `decisions.skills.<name>.install === true` → ✅ インストール済み
- `decisions.skills.<name>.install === false` → ❌ スキップ済み
- エントリが存在しない → ⏳ 未評価

表示例:

```
## スキル

- commit ✅ インストール済み
  - source: myuon/agent-skills
  - condition: always
- react-no-useeffect ⏳ 未評価
  - source: myuon/agent-skills
  - condition: React を使っているプロジェクト
```
