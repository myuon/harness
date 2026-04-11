---
name: install
description: "マニフェストを読み込み、プロジェクトに合致するスキルをインストールする"
---

# install スキル

## トリガー

`/harness:install` または `/install`

## 手順

### 1. 読み込み（並列実行）

以下を**すべて並列で**読み込む:

- `~/.config/harness/manifest.json`（なければ `{"skills": {}, "profiles": {}}` を作成して終了）
- `.harness-decisions.json`（なければ `{"decisions": {"skills": {}, "profiles": {}}}` として扱う）
- `npx skills ls -g --json` の結果（グローバルインストール済みスキル一覧）
- `npx skills ls --json` の結果（プロジェクトローカルインストール済みスキル一覧）

### 2. 条件評価

マニフェストの各スキルについて:

- 判断記録に既にあれば → スキップ
- `condition: "always"` → `install: true`
- その他 → プロジェクトの実態（package.json, ディレクトリ構造, 設定ファイル等）を確認して評価

### 3. インストール

`install: true` の各スキルについて:

1. **既にインストール済みか確認**: ステップ1で取得した一覧にスキル名があればスキップ（`scope: "global"` ならグローバル一覧、それ以外はローカル一覧を参照）
2. **未インストールならインストール実行**:
   - `scope: "global"` → `npx skills add <source> --skill <name> -g -y`
   - `scope: "project"`（デフォルト）→ `npx skills add <source> --skill <name> -y`

### 4. プロファイル（profiles が空なら省略）

manifest の `profiles` が空でなければ、各プロファイルの condition を評価し、`apply: true` のものの hooks を `.claude/settings.json` にマージする（`"_managedBy": "harness"` 付与）。

### 5. 記録と表示

1. `.harness-decisions.json` に判断結果を書き込む
2. サマリーをテーブル形式で表示（スキル名 / 結果 / 理由）

## 注意

- condition 評価は推測ではなく実際にファイルを読んで行う
- 判断に迷ったらユーザーに確認する
- 既存の判断記録は上書きしない
- `scope` 省略時は `"project"`
