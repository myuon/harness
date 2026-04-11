---
name: add
description: "manifest にスキルを追加。condition はエージェントが自動提案"
---

# add スキル

スキルエントリを `~/.config/harness/manifest.json` に追加する。

## 引数

```
/harness:add <source> <skill>
```

- `<source>`: `owner/repo` 形式のリポジトリ（例: `myuon/agent-skills`）
- `<skill>`: スキル名（例: `commit`）

## 手順

1. **引数をパースする**
   - `<source>` と `<skill>` を受け取る
   - 引数が指定されていない場合はユーザーに入力を促すか、以下を提案する:
     ```bash
     npx skills search <keyword>
     ```

2. **GitHub から SKILL.md を取得してスキルの内容を把握する**
   ```bash
   gh api repos/<owner>/<repo>/contents/skills/<skill>/SKILL.md --jq '.content' | base64 --decode
   ```
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
     "<skill>": {
       "source": "<source>",
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
