# tuistory を使った動作確認

[tuistory](https://github.com/remorses/tuistory) は「TUI の Playwright」。Claude Code を pty で起動してスラッシュコマンドを自動実行し、プラグインのインストールフローや SKILL.md の動作を検証できる。

## セットアップ

```bash
npm install -g tuistory
```

## プラグインインストールフローの検証

### 1. Claude Code セッションを起動

```bash
tuistory launch "claude" -s harness-test --cols 150 --rows 45 --cwd /tmp/harness-test-project
```

### 2. 起動を待ち、trust ダイアログを処理

```bash
# 起動画面が表示されるまで待機
tuistory -s harness-test wait-idle --timeout 15000

# スナップショットで状態確認
tuistory -s harness-test snapshot --trim

# trust 確認が出ていたら Enter で承認
tuistory -s harness-test press enter
```

### 3. マーケットプレイス追加

```bash
tuistory -s harness-test type "/plugin marketplace add myuon/harness"
sleep 1
tuistory -s harness-test press enter
tuistory -s harness-test wait-idle --timeout 10000
tuistory -s harness-test snapshot --trim
# 期待: "Successfully added marketplace: myuon-harness"
```

### 4. プラグインインストール

```bash
tuistory -s harness-test type "/plugin install harness@myuon-harness"
sleep 1
tuistory -s harness-test press enter
tuistory -s harness-test wait-idle --timeout 15000
tuistory -s harness-test snapshot --trim
# 期待: インストール成功 or "already installed"
```

### 5. プラグインリロード

```bash
tuistory -s harness-test type "/reload-plugins"
sleep 1
tuistory -s harness-test press enter
tuistory -s harness-test wait-idle --timeout 10000
tuistory -s harness-test snapshot --trim
# 期待: "Reloaded: N plugins · M skills ..."（skills に harness の 5 スキルが含まれる）
```

### 6. クリーンアップ

```bash
tuistory -s harness-test close
```

## Tips

- `snapshot --trim` で現在の画面状態をテキストとして取得できる。結果の確認に使う
- `wait-idle --timeout <ms>` でコマンド実行完了を待てる
- `wait "<text>" --timeout <ms>` で特定テキストの出現を待てる
- `type` でテキスト入力後、`press enter` で送信。間に `sleep 1` を挟むと安定する
- `press ctrl+c` で中断、`press escape` でキャンセルなど、キー操作も可能
- セッション名（`-s`）を変えれば複数の Claude Code セッションを並行して操作できる

## SKILL.md の動作確認

スキルの動作確認も同様の手順で行える:

```bash
# /harness:install の動作確認
tuistory -s harness-test type "/harness:install"
sleep 1
tuistory -s harness-test press enter
tuistory -s harness-test wait-idle --timeout 30000
tuistory -s harness-test snapshot --trim
```

スキルの実行は時間がかかるため、`wait-idle` の timeout を長めに設定すること。
