# Minimal TV Clock

Android TVで常時表示する、ローカルWebViewベースのミニマルな時計・カレンダーアプリです。

## 表示内容

- 現在時刻（HH:mm、秒なし）
- 日付と曜日
- JavaScriptで自動生成する当月カレンダー
- 今日の日付の強調表示

外部API、外部カレンダー、予定データ、社内情報は使用しません。

## Android TV対応

- `LEANBACK_LAUNCHER` でTVホーム画面から起動できます。
- 横向き全画面表示を前提にしています。
- 戻るボタンでアプリを終了します。
- Activity側でスリープ抑止を設定しています。

## ビルド

Android Studioでこのディレクトリを開き、Android SDK / Gradle Pluginを同期してから実行してください。

```bash
gradle assembleDebug
```
