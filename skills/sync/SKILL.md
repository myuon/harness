---
name: sync
description: インストール済みスキルと manifest を比較し、未登録のものがあれば追加を提案
---

## 概要

ローカルにインストールされているスキルと `~/.config/harness/manifest.json` の内容を比較し、manifest に未登録のスキルをユーザーに提示して追加を提案する。

## 手順

### 1. インストール済みスキルを取得する

以下のコマンドを実行してインストール済みスキルの一覧を取得する:

```bash
npx skills ls --json
npx skills ls -g --json
```

両コマンドの結果をマージしてインストール済みスキルの完全なリストを作成する。

### 2. manifest を読み込む

`~/.config/harness/manifest.json` を読み込む。

ファイルが存在しない場合:
- 以下の内容で新規作成する:
  ```json
  {
    "skills": {},
    "profiles": {}
  }
  ```

### 3. 未登録スキルを特定する

インストール済みスキルのリストと manifest の `skills` セクションを比較し、manifest に登録されていないスキルを特定する。

未登録スキルが存在しない場合:
- 「すべてのスキルは manifest に登録済みです」と伝えて終了する。

### 4. 各未登録スキルの情報を収集する

未登録スキルごとに以下を行う:

1. そのスキルの `SKILL.md` を読み込んで description を確認する
2. description の内容からユーザーへの適用条件（condition）を推論する
   - 例: "React コンポーネントのレビュー" → condition: "React を使っているプロジェクト"
   - 例: "git commit を実行" → condition: "always"
   - 条件が判断できない場合は condition を空文字列にしておく

### 5. ユーザーに確認を求める

各未登録スキルについて以下の情報を提示し、manifest への追加を確認する:

```
以下のスキルが manifest に登録されていません。追加しますか？

1. <name>
   - source: <source>
   - description: <description>
   - 推奨 condition: <condition>
   追加する / スキップ / condition を変更する
```

ユーザーが「condition を変更する」を選択した場合は、新しい condition の入力を求める。

### 6. manifest を更新する

ユーザーが追加を確認したスキルを manifest の `skills` セクションに追加する。

追加形式:
```json
"<name>": {
  "source": "<source>",
  "condition": "<condition>"
}
```

更新後の manifest を `~/.config/harness/manifest.json` に書き込む。

### 7. サマリーを表示する

処理結果をまとめて表示する:

```
## sync 完了

追加したスキル (<追加数> 件):
- <name> (condition: <condition>)

スキップしたスキル (<スキップ数> 件):
- <name>
```
