---
name: try
description: "skills.sh から SKILL.md を fetch して今のセッションで読むだけ。インストールしない"
---

# try スキル

skills.sh 上のスキルを一時的にセッションへ読み込む。ディスクへの書き込みは行わない。

## 引数

```
/harness:try <owner>/<repo>@<skillname>
```

- 例: `/harness:try wshobson/agents@architecture-decision-records`
- `owner`: GitHub ユーザー名または Organization
- `repo`: リポジトリ名
- `skillname`: スキルのスラッグ名

## 手順

1. **引数をパースする**
   - `<owner>/<repo>@<skillname>` を受け取り、`owner`、`repo`、`skillname` に分解する
   - 形式が正しくない場合は使い方を案内する

2. **skills.sh のダウンロード API から SKILL.md を取得する**
   - WebFetch を使って以下の URL にアクセスする:
     ```
     https://skills.sh/api/download/{owner}/{repo}/{skillname}
     ```
   - レスポンスは JSON 形式で、構造は `{ hash, files: [{ path, contents }] }`
   - `files` 配列の中から `path === "SKILL.md"` のエントリを探し、その `contents` を使用する

3. **取得した内容を読み込み、指示に従う**
   - 取得した SKILL.md の内容をユーザーに提示する
   - その内容をローカルにインストール済みのスキルと同様に扱い、指示に従って動作する

4. **一時的な読み込みであることをユーザーに伝える**
   - このスキルはセッション限りで有効であり、ディスクには何も書き込まれない
   - 恒久的に追加したい場合は以下を実行するよう案内する:
     ```
     /harness:add <owner>/<repo>@<skillname>
     ```

5. **エラー処理**
   - fetch に失敗した場合は原因を明示する:
     - 引数形式が不正（`owner/repo@skillname` でない）
     - 指定したスキルが skills.sh に存在しない
     - レスポンスの `files` 配列に `SKILL.md` が含まれていない
     - その他のネットワークエラー
