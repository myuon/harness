---
name: install
description: "マニフェストを読み込み、プロジェクトに合致するスキルをインストールする"
---

# install スキル

マニフェストを読み込み、プロジェクトの実態を見て condition を評価し、必要なスキルをインストールする。

## トリガー

`/harness:install` または `/install`

## 手順

以下のステップを順番に実行すること。

### 1. マニフェストの読み込み

`~/.config/harness/manifest.json` を読み込む。

- ファイルが存在しない場合 → 空のマニフェスト `{"skills": {}, "profiles": {}}` を作成し、ユーザーに通知する。続けて `/harness:sync` の実行を提案して終了する。

### 2. 既存の判断記録の読み込み

プロジェクトルートの `.harness-decisions.json` を読み込む。

- ファイルが存在しない場合 → 空の状態 `{"decisions": {"skills": {}, "profiles": {}}}` として扱う。

### 3. 各スキルの条件評価

マニフェストの `skills` に含まれる各スキルについて以下を実行する。

**すでに判断記録に存在するスキルはスキップする**（既存の判断記録は上書きしない）。

条件に応じて判断を決定する:

- `condition: "always"` → `install: true`, `reason: "always"`
- その他の condition 文字列 → プロジェクトの実態を調べて評価する

**condition 評価の方法** (推測ではなく実際にファイルを読むこと):

1. `package.json` が存在する場合 → `dependencies` / `devDependencies` を確認する
2. ディレクトリ構造を確認する（`src/`, `app/`, `pages/` など）
3. ファイルの拡張子を確認する（`.tsx`, `.go`, `.py` など）
4. フレームワーク設定ファイルを確認する（`next.config.js`, `vite.config.ts`, `go.mod`, `Cargo.toml` など）

評価結果を `install: true/false` と具体的な `reason` とともに記録する。

判断に迷った場合はユーザーに確認してから進む。

### 4. スキルのインストール

`install: true` と判断された各スキルについて以下のコマンドを実行する:

```bash
npx skills add <source> --skill <name> -y
```

`source` と `name` はマニフェストから取得する（例: `source: "myuon/agent-skills"`, `name: "commit"`）。

### 5. プロファイル/フックの評価と適用

マニフェストの `profiles` セクションに含まれる各プロファイルについて以下を実行する。

#### 5-1. 条件評価

**すでに判断記録に存在するプロファイルはスキップする**（既存の判断記録は上書きしない）。

条件評価はスキルと同様の方法で行う（Step 3 参照）:

- `condition: "always"` → `apply: true`, `reason: "always"`
- その他の condition 文字列 → プロジェクトの実態を調べて評価する

評価結果を `apply: true/false` と具体的な `reason` とともに記録する。

#### 5-2. 古いフックの削除（クリーンアップ）

`.claude/settings.json` を読み込み（存在しない場合は空として扱う）、`"_managedBy": "harness"` が付いているフックのうち、今回 `apply: true` となったプロファイルのいずれにも含まれないフックを削除する。

これにより、プロファイルの適用条件が変わった際に古いフックが残り続けることを防ぐ。

#### 5-3. フックの適用

`apply: true` と判断された各プロファイルについて以下を行う:

1. `.claude/settings.json` を読み込む（存在しない場合は `{}` として扱い、後で新規作成する）
2. プロファイルの `hooks` 配列の各フックについて:
   - 同じイベント・matcher・コマンドを持つフックがすでに存在する場合はスキップ（重複追加しない）
   - 存在しない場合は、フックエントリに `"_managedBy": "harness"` フィールドを追加して、対応するイベント配列に追加する
3. 更新した内容を `.claude/settings.json` に書き込む

**`.claude/settings.json` のフックフォーマット:**

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit",
        "hooks": [
          {
            "type": "command",
            "command": "npx eslint --fix $CLAUDE_FILE_PATH",
            "_managedBy": "harness"
          }
        ]
      }
    ]
  }
}
```

なお、`.claude/settings.json` のフック構造は Claude Code の仕様に従うこと。同一の matcher エントリがすでに存在する場合は、その `hooks` 配列に追記する。

### 6. 判断記録の書き込み

更新した判断記録をプロジェクトルートの `.harness-decisions.json` に書き込む。

フォーマット:

```json
{
  "decisions": {
    "skills": {
      "commit": { "install": true, "reason": "always" },
      "react-no-useeffect": { "install": true, "reason": "package.json に react@19 あり" },
      "agent-browser": { "install": false, "reason": "CLI ツールのため画面なし" }
    },
    "profiles": {
      "react": { "apply": true, "reason": "package.json に react@19 あり" },
      "node": { "apply": false, "reason": "Rust プロジェクトのため対象外" }
    }
  }
}
```

### 7. サマリーの表示

以下の区分でユーザーに結果を表示する:

**スキル:**

- **インストール済み**: 今回インストールしたスキル（reason 付き）
- **スキップ**: `install: false` と判断したスキル（reason 付き）
- **判断済み（変更なし）**: すでに `.harness-decisions.json` に記録されていたためスキップしたスキル

**プロファイル/フック:**

- **適用済みプロファイル**: 今回 `apply: true` と判断したプロファイル（reason 付き、適用したフック数も表示）
- **スキップしたプロファイル**: `apply: false` と判断したプロファイル（reason 付き）
- **判断済み（変更なし）**: すでに `.harness-decisions.json` に記録されていたためスキップしたプロファイル
- **削除した古いフック**: `_managedBy: "harness"` が付いていたが今回のプロファイルに含まれなかったため削除したフック（あれば表示）

## 注意事項

- condition 評価はプロジェクトの実態を確認して行う（推測ではなく実際にファイルを読む）
- 判断に迷った場合はユーザーに確認する
- 既存の判断記録は上書きしない（記録を消して再実行する運用）
