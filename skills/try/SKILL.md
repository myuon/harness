---
name: try
description: "GitHub から SKILL.md を fetch して今のセッションで読むだけ。インストールしない"
---

# try スキル

GitHub 上のスキルを一時的にセッションへ読み込む。ディスクへの書き込みは行わない。

## 引数

```
/harness:try <source> <skill>
```

- `<source>`: `owner/repo` 形式のリポジトリ（例: `myuon/agent-skills`）
- `<skill>`: スキル名（例: `commit`）

## 手順

1. **引数をパースする**
   - `<source>` と `<skill>` を受け取る
   - 引数が不足している場合は使い方を案内する

2. **GitHub から SKILL.md を取得する**
   ```bash
   gh api repos/<owner>/<repo>/contents/skills/<skill>/SKILL.md --jq '.content' | base64 --decode
   ```
   - `<owner>/<repo>` は `<source>` を `/` で分割して得る
   - `<skill>` はそのまま使用する

3. **取得した内容を読み込み、指示に従う**
   - デコードした SKILL.md の内容をユーザーに提示する
   - その内容をローカルにインストール済みのスキルと同様に扱い、指示に従って動作する

4. **一時的な読み込みであることをユーザーに伝える**
   - このスキルはセッション限りで有効であり、ディスクには何も書き込まれない
   - 恒久的に追加したい場合は以下を実行するよう案内する:
     ```
     /harness:add <source> <skill>
     ```

5. **エラー処理**
   - fetch に失敗した場合は原因を明示する:
     - リポジトリが存在しない
     - 指定したスキルが見つからない
     - GitHub CLI の認証エラー
     - その他のネットワークエラー
