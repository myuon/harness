# harness

宣言的ハーネス管理ツール — AI コーディングエージェント（Claude Code、Codex など）の skills と hooks をプロジェクトごとに管理します。

## 概要

AI エージェントのスキルをグローバルに管理するのはプロジェクトごとの要件に合わず、うまくいきません。例えば React プロジェクトにだけ適用したいスキルや、特定のフレームワークを使っているときだけ有効にしたいフックなど、プロジェクトの実態に応じた管理が必要です。

harness は manifest ファイルにスキルを宣言的に記述し、エージェントがプロジェクトの実態（`package.json` の依存関係など）を見て condition を評価し、必要なスキルとフックを自動で適用する仕組みを提供します。

一度下した判断は `.harness-decisions.json` に記録されるため、次回以降は再評価なしで即時適用できます。

## 特徴

- **manifest でスキルを一元管理** — `~/.config/harness/manifest.json` にスキルとプロファイルを宣言的に記述
- **condition による自動評価** — プロジェクトの実態をエージェントが確認し、各スキル・プロファイルの適用要否を判断
- **判断記録（`.harness-decisions.json`）** — 一度の判断結果をプロジェクトルートに保存し、以降の実行で再利用
- **try で一時利用** — ファイルシステムに何も残さず、セッション内だけでスキルを試せる
- **Claude Code プラグイン + npx skills の両対応** — 好みのインストール方法を選択可能

## インストール

### Claude Code プラグイン（推奨）

Claude Code の設定ファイル（`~/.claude/settings.json` または `.claude/settings.json`）の `plugins` に追加します。

```json
{
  "plugins": [
    "myuon/harness"
  ]
}
```

その後、Claude Code を再起動するとスキルが利用可能になります。

### npx skills

すべてのスキルを一括インストールする場合：

```bash
npx skills add myuon/harness --all -y
```

特定のスキルのみインストールする場合：

```bash
npx skills add myuon/harness --skill install
npx skills add myuon/harness --skill try
```

## 使い方

| コマンド | 説明 |
|---------|------|
| `/harness:install` | manifest を読み condition 評価 → スキル適用 → 判断記録 |
| `/harness:try <source> <skill>` | 一時的に SKILL.md を読み込み（インストールなし） |
| `/harness:add <source> <skill>` | manifest にスキルを追加（condition はエージェントが自動提案） |
| `/harness:list` | manifest の内容を表示 |
| `/harness:sync` | インストール済みスキルと manifest を比較し、未登録のものがあれば追加を提案 |

## manifest フォーマット

manifest は `~/.config/harness/manifest.json` に配置します。

```json
{
  "skills": {
    "commit": {
      "source": "myuon/agent-skills",
      "condition": "always"
    },
    "react-no-useeffect": {
      "source": "myuon/agent-skills",
      "condition": "React を使っているプロジェクト"
    }
  },
  "profiles": {
    "react": {
      "condition": "React を使っているプロジェクト",
      "hooks": [
        {
          "event": "PostToolUse",
          "matcher": "Edit",
          "command": "npx eslint --fix $CLAUDE_FILE_PATH"
        }
      ]
    }
  }
}
```

### フィールド説明

#### skills

| フィールド | 説明 |
|-----------|------|
| `source` | スキルが配置されている GitHub リポジトリ（`owner/repo` 形式） |
| `condition` | 適用条件。`"always"` で常に適用、自然言語でプロジェクトの条件を記述することも可能 |

#### profiles

プロファイルはスキルのセットとフックをまとめたものです。

| フィールド | 説明 |
|-----------|------|
| `condition` | プロファイルを適用する条件（自然言語で記述） |
| `hooks` | 適用するフックのリスト |
| `hooks[].event` | フックを発火するイベント（例: `PostToolUse`, `PreToolUse`） |
| `hooks[].matcher` | フックを適用するツール名（例: `Edit`, `Bash`） |
| `hooks[].command` | 実行するコマンド |

## 判断記録

`/harness:install` を実行すると、各スキル・プロファイルへの condition 評価結果がプロジェクトルートの `.harness-decisions.json` に保存されます。

```json
{
  "decisions": {
    "skills": {
      "commit": { "install": true, "reason": "always" },
      "react-no-useeffect": { "install": true, "reason": "package.json に react@19 あり" }
    },
    "profiles": {
      "react": { "apply": true, "reason": "package.json に react@19 あり" }
    }
  }
}
```

次回の `/harness:install` 実行時はこの記録を参照し、再評価なしで即時適用します。判断をリセットしたい場合はファイルを削除してください。

`.harness-decisions.json` はプロジェクトの `.gitignore` に追加することを推奨します（個人の環境依存の判断が含まれるため）。

## フック管理

### プロファイルとフック

プロファイルは condition と hooks をセットで定義します。`/harness:install` 実行時に condition が評価され、`apply: true` となったプロファイルのフックが `.claude/settings.json` に書き込まれます。

```json
{
  "profiles": {
    "react": {
      "condition": "React を使っているプロジェクト",
      "hooks": [
        {
          "event": "PostToolUse",
          "matcher": "Edit",
          "command": "npx eslint --fix $CLAUDE_FILE_PATH"
        }
      ]
    }
  }
}
```

### `_managedBy: "harness"` による識別

harness が書き込んだフックには `"_managedBy": "harness"` フィールドが付与されます。これにより、手動で追加したフックと harness が管理するフックを区別できます。

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

### 古いフックの自動クリーンアップ

`/harness:install` を再実行すると、`_managedBy: "harness"` が付いているフックのうち、現在 `apply: true` となっているプロファイルに含まれないフックは自動的に削除されます。

これにより以下のケースで古いフックが自動クリーンアップされます:

- プロジェクトの技術スタックが変わり、プロファイルの condition が `apply: false` に変わった場合
- manifest からプロファイルを削除した場合
- フックの内容を変更した場合（古いコマンドが残らない）

手動で追加したフック（`_managedBy` フィールドなし）は削除されません。

### フックの書き込み先

フックは `.claude/settings.json`（プロジェクトローカルの Claude Code 設定）に書き込まれます。グローバル設定（`~/.claude/settings.json`）は変更されません。

## ライセンス

MIT
