# Skill: harness:install

**Description**: マニフェストを読み込み、プロジェクトに合致するスキルをインストールする  
**Trigger**: `/harness:install` または `/install`

---

## Instructions

以下のステップを順番に実行すること。

### Step 1: マニフェストの読み込み

`~/.config/harness/manifest.json` を読み込む。

- ファイルが存在しない場合 → 空のマニフェスト `{"skills": {}, "profiles": {}}` を作成し、ユーザーに通知する。続けて `/harness:sync` の実行を提案して終了する。

### Step 2: 既存の判断記録の読み込み

プロジェクトルートの `.harness-decisions.json` を読み込む。

- ファイルが存在しない場合 → 空の状態 `{"decisions": {"skills": {}, "profiles": {}}}` として扱う。

### Step 3: 各スキルの条件評価

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

### Step 4: スキルのインストール

`install: true` と判断された各スキルについて以下のコマンドを実行する:

```bash
npx skills add <source> --skill <name> -y
```

`source` と `name` はマニフェストから取得する（例: `source: "myuon/agent-skills"`, `name: "commit"`）。

### Step 5: プロファイル/フックの評価

<!-- TODO: Phase 1 では profiles の評価はスキップする。将来的に profiles の条件評価とフックの適用を実装する。 -->

現時点では profiles の処理は行わない。

### Step 6: 判断記録の書き込み

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
    "profiles": {}
  }
}
```

### Step 7: サマリーの表示

以下の3区分でユーザーに結果を表示する:

- **インストール済み**: 今回インストールしたスキル（reason 付き）
- **スキップ**: `install: false` と判断したスキル（reason 付き）
- **判断済み（変更なし）**: すでに `.harness-decisions.json` に記録されていたためスキップしたスキル

---

## Important Notes

- condition 評価はプロジェクトの実態を確認して行う（推測ではなく実際にファイルを読む）
- 判断に迷った場合はユーザーに確認する
- 既存の判断記録は上書きしない（記録を消して再実行する運用）
