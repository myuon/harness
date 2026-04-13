---
name: add
description: "manifest にスキルを追加。condition はエージェントが自動提案"
---

# add スキル

スキルエントリを `~/.config/harness/manifest.json` に追加する。

## 引数

```
/harness:add <owner>/<repo>@<skillname>
```

- 例: `/harness:add wshobson/agents@architecture-decision-records`
- `owner`: GitHub ユーザー名または Organization
- `repo`: リポジトリ名
- `skillname`: スキルのスラッグ名（find-skills が返す形式と同じ）

## 手順

1. **引数をパースする**
   - `<owner>/<repo>@<skillname>` を受け取り、`owner`、`repo`、`skillname` に分解する
   - 形式が正しくない場合は使い方を案内する

2. **skills.sh から SKILL.md を取得してスキルの内容を把握する**
   - WebFetch を使って以下の URL にアクセスする:
     ```
     https://skills.sh/api/download/{owner}/{repo}/{skillname}
     ```
   - レスポンスは JSON 形式で、構造は `{ hash, files: [{ path, contents }] }`
   - `files` 配列の中から `path === "SKILL.md"` のエントリを探し、その `contents` を使用する
   - スキルの説明・用途・トリガー条件を読み取る

3. **`condition` を自動提案する**
   - SKILL.md の内容を分析し、適切な condition を判断する:
     - 汎用的なスキル（git 操作、コミット、汎用ツールなど）→ `"always"` を提案
     - 特定フレームワーク・言語に依存するスキル → 日本語で具体的な条件を提案（例: `"React を使っているプロジェクト"`、`"Go のプロジェクト"`）
   - 提案理由も簡潔に説明する

4. **ユーザーに確認する**
   - 提案した condition をユーザーに提示し、確認または修正を待つ
   - ユーザーが修正した場合はその内容を採用する

5. **manifest を読み込む**
   - `~/.config/harness/manifest.json` を読み込む
   - ファイルが存在しない場合は以下の内容で新規作成する:
     ```json
     {"skills": {}, "profiles": {}}
     ```

6. **スキルエントリを追加する**
   - `skills` オブジェクトに以下を追加する:
     ```json
     "<skillname>": {
       "source": "<owner>/<repo>",
       "condition": "<確認済みの condition>"
     }
     ```
   - 既に同名のスキルが存在する場合は上書き前にユーザーへ確認する

7. **manifest を保存する**
   - 更新した内容を `~/.config/harness/manifest.json` に書き込む

8. **完了をユーザーに伝える**
   - スキルが追加されたことを報告する
   - 今すぐ反映させたい場合は以下を実行するよう案内する:
     ```
     /harness:install
     ```
