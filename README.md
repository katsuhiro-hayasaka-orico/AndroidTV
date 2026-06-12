# Deep Sea Ambient Clock for Android TV

Android TVで常時表示する、ローカルWebViewベースの「AbyssalDriftTvベース深海UI + 時計 + チャイム」アプリです。旧 Minimal TV Clock の時計・カレンダー・音声チャイム・ビジュアルアラーム・数字フォントプリセットを維持しつつ、参照リポジトリ AbyssalDriftTv の `ABYSSAL DRIFT`、深度表示、探査HUD、暗い深海観測装置風の世界観をローカルHTML/CSS/JSへ統合しています。

外部API、外部CDN、外部フォントURL、外部音源URLは使用しません。Android WebViewは `file:///android_asset/index.html` からローカルアセットのみを読み込み、Activity側でネットワークロードをブロックします。

## 表示内容

- 濃紺〜黒の深海グラデーションと上部からの弱い青い光
- 水の濁り、奥行き減衰、遠方の海底影、ゆっくり流れる水流ノイズ
- 1,200個のマリンスノー粒子と180個の微細な発光プランクトン
- プロシージャルな深海生物
  - 透明感のあるクラゲ 4体
  - 細長い深海魚シルエット 6体
  - 遠景の巨大生物らしき影 2体
- 現在時刻（HH:mm、秒なし）
- デジタル時計 / アナログ時計の切り替え表示
- JavaScriptで自動生成する当月カレンダー（数字は時計フォントプリセットに連動）
- 今日の日付の強調表示
- AbyssalDriftTv由来の `ABYSSAL DRIFT` HUD、深度テレメトリ、深海探査装置風の薄いグリッド／ビーム
- 右下の `Created by Innovation Lab` クレジット（深海観測装置の刻印のように控えめに常時表示）


## AbyssalDriftTv UI統合

`app/src/main/assets/index.html` は単純置換ではなく、既存AndroidTVアプリのDOM IDと機能ロジックを残したまま、AbyssalDriftTvのHTMLベース深海UI要素をオーバーレイとして再構成しています。

- 取り込んだ要素: `ABYSSAL DRIFT` タイトル、`— 深海 2,800m —` の観測ラベル、深度表示、HUD風の状態表示、暗いシアン系グリッド、上方から差す探査光、ガラス調パネル。
- Android TV向け変更: 参照HTMLにある外部CDN / 外部Webフォント依存は持ち込まず、既存のローカル `deep-sea.js`、`style.css`、同梱 `fonts/*.woff2`、`audio/chime.mp3` のみで完結します。
- `app/src/main/assets/abyssal-ui.js` は深度・日付・DRIFT値・わずかなHUD揺らぎだけを担当し、時計・チャイム・フォントプリセットには依存しません。仮にこの演出でエラーが出ても、時計とチャイムの主要処理は `app.js` 側で維持されます。
- 旧 `lab-signature` / 起動時 `launchCredit` は重複を避けるため整理し、正式な常時表示クレジットは右下の `.innovation-credit` に統合しました。

## 維持しているDOM ID

Abyssal UI化後も既存ロジックの互換性を保つため、以下のIDは `index.html` に残しています。

- `display` / `time` / `monthTitle` / `calendar`
- `fontToast` / `chimeToast` / `chimeAudio`
- `analogClock` / `hourHand` / `minuteHand` / `analogLabel`

## 操作方法

- 初期表示はデジタル時計です。
- Android TVリモコンの決定ボタン、またはキーボードの Enter キーで、デジタル時計とアナログ時計を切り替えます。
- Android TVリモコンの右キー / 左キー、またはキーボードの ArrowRight / ArrowLeft で、デジタル時計の数字フォントプリセットを切り替えます。
- 選択した時計表示モードと数字フォントプリセットはWebViewの `localStorage` に保存され、次回起動時も維持されます。
- プリセット切り替え時のみ、画面下部に `Font: Readable` などの小さな一時表示を約2秒出します。
- 戻るボタンでアプリを終了します。

## 数字フォントプリセット

- `readable`: 既定プリセットです。3〜5m離れた視認性と数字の判別性を最優先します。
- `soft`: 丸みと淡い光沢を加えた、上品で柔らかい印象のプリセットです。
- `handwritten`: 回転や上下差を最小限に抑えた、時計として読める範囲の手書き風プリセットです。
- `design`: 字間・太さ・数字ごとの幅をやや攻めた、バウハウス／ギャラリー寄りのモダンデザインプリセットです。

選択中のプリセットはデジタル時計の数字だけでなく、カレンダーの日付数字と年月タイトルの数字部分にも反映されます。曜日行と「年」「月」は可読性優先の通常日本語フォントスタックです。

## ローカルフォント

数字フォントは `app/src/main/assets/fonts/` に以下の `woff2` ファイルを置くことで差し替えできます。フォントファイルは必ずライセンス確認済みのものだけを同梱してください。外部WebフォントやGoogle Fontsなどの外部URLは使用しません。

- `readable.woff2` → `ClockReadable`
- `soft.woff2` → `ClockSoft`
- `handwritten.woff2` → `ClockHandwritten`
- `design.woff2` → `ClockDesign`

フォントを追加・変更した場合は、Android TVエミュレーターと実機の両方で `00:00`、`08:08`、`11:11`、`18:58`、`20:48`、`23:59` など横幅が出やすい時刻を確認してください。フォントファイルが存在しない場合でも、Android WebViewのフォールバックフォントで表示されます。

## 深海WebGL背景

`app/src/main/assets/deep-sea.js` に、Android TV WebView向けの軽量なプロシージャルWebGL背景を実装しています。Viteやnpmビルドを必須にせず、Android StudioでそのままビルドできるMVPを優先しています。

- 背景全面の `canvas#deepSeaCanvas` に描画します。
- 時計、カレンダー、Toast、Abyssal HUD、Innovation LabクレジットはHTML/CSSの前面オーバーレイです。
- 3Dモデルや外部テクスチャに依存せず、粒子・シェーダー・軽量ジオメトリ・錯視で深海の奥行きを表現します。
- 動的ライトや重いポストプロセスは使わず、フルスクリーン背景シェーダー、Points相当の粒子、簡単なプロシージャル生物だけで構成しています。
- `window.devicePixelRatio` は最大 `1.5` に制限し、1080p / 30fps相当の安定動作を狙います。
- WebGLコンテキストロスト、WebGL非対応、シェーダー初期化失敗時はCSSグラデーション背景へフォールバックし、時計・カレンダー・チャイムは継続します。
- ページ非表示時は `requestAnimationFrame` を停止し、復帰時に再開します。
- `resize` でcanvas解像度とviewportを更新します。

## デザイン方針

- 単なる水族館ではなく、常時表示に耐える暗さの「深海アンビエント」に寄せています。
- 生物は時計・カレンダーを邪魔しない距離と透明度に抑え、直線移動ではなくsin波の遅延・揺らぎで泳がせています。
- 画面上部の青い光、遠景の地形影、マリンスノー、微細な発光点、AbyssalDriftTv風HUDで奥行きと水の濁りを作ります。
- 時計・カレンダーは半透明パネル、薄いグロー、十分なコントラストを与え、3〜5m離れたTV視聴距離でも読みやすくしています。
- 常時表示対策として、既存の `nudgeDisplay` による微小位置移動を維持しています。

## 音声チャイム

指定時刻に、控えめな音量の短い「キンコンカンコン」系チャイムを鳴らす音声チャイム機能を維持しています。外部API、外部音源URL、外部Webフォントは使用せず、WebView内のローカルアセットとJavaScriptだけで完結します。

- 音声チャイム時刻は `09:20`、`11:30`、`12:30`、`17:45` の4回です。
- 設定は `app/src/main/assets/app.js` の `SOUND_CHIME` 定数にまとめています。既定音量は `volume: 0.32` です。
- ローカル音源は `app/src/main/assets/audio/chime.mp3` です。音源ファイルを差し替える場合は、必ず再配布・アプリ同梱が可能なライセンスの短い音源だけを配置してください。
- `chime.mp3` が読み込み不可、または再生不可の場合でも時計表示は継続します。可能な環境では Web Audio API で短い簡易チャイムを生成してフォールバック再生します。
- 同じ日付・同じ時刻のチャイムは重複再生しません。

## ビジュアルアラーム

音を鳴らさず、WebView内のローカルHTML/CSS/JavaScriptだけで画面の雰囲気を変える固定1件のビジュアルアラームを維持しています。

- 設定は `app/src/main/assets/app.js` の `VISUAL_ALARM` 定数にまとめています。初期値は `enabled: true`、`hour: 17`、`minute: 0`、`leadMinutes: 30`、`fadeOutMinutes: 10` です。
- 設定時刻の30分前から `--alarm-intensity` を 0〜1 の範囲で徐々に上げ、17:00に最大になります。
- 深海背景では、光量・発光粒子・背景色温度がわずかに変化します。
- 点滅、音声、バイブレーション、Android通知、外部API、外部カレンダー連携は使用しません。

## Android TV対応

- `LEANBACK_LAUNCHER` でTVホーム画面から起動できます。
- 横向き全画面表示を前提にしています。
- 戻るボタンでアプリを終了します。
- Activity側でスリープ抑止を設定しています。
- WebView側でネットワークロードをブロックし、ローカルアセットのみを表示します。

## ビルド

Android Studioでこのディレクトリを開き、Android SDK / Gradle Pluginを同期してから実行してください。WebGL背景はローカルJSとして同梱しているため、追加のnpm/Viteビルドは不要です。

```bash
gradle assembleDebug
```

## 実機確認チェックリスト

- 1080pで30fps相当の滑らかさがあること。
- 2時間連続表示して、WebViewクラッシュ、WebGLコンテキストロスト、メモリ増加による劣化がないこと。
- 3〜5m離れて時計・カレンダーを読めること。
- `09:20`、`11:30`、`12:30`、`17:45` のチャイム時刻で既存機能が動作すること。
- 17:00のビジュアルアラーム前後で、深海の光量・発光粒子・背景色温度がわずかに変化すること。
- WebGLを無効化した端末やWebGL初期化失敗時に、CSSグラデーション背景へフォールバックし、時計表示が壊れないこと。
- 右キー / 左キーで `readable`、`soft`、`handwritten`、`design` が切り替わり、再起動後も `localStorage` の設定が維持されること。
- DevToolsやWebViewデバッグ環境が使える場合は `window.playTestChime()` を実行し、`audio/chime.mp3` またはWeb Audio APIフォールバックでテスト再生できること。
- 右下の `Created by Innovation Lab` が時計、カレンダー、チャイムToastを邪魔せず、明るすぎないこと。
- 戻るボタン終了、LEANBACK_LAUNCHER、横向き全画面、スリープ抑止、WebViewローカルアセット読み込みが維持されていること。

## 既知の制約・今後の改善余地

- 現在はAndroid Studioで即ビルドできるMVPを優先し、Three.jsのローカルbundle化は行っていません。AbyssalDriftTvの外部CDN依存をそのまま取り込む代わりに、既存の軽量WebGL背景とCSS HUDで世界観を再現しています。
- `abyssal-ui.js` の深度・DRIFT値は演出用のプロシージャル表示であり、外部センサーやAPIとは連携していません。
- 長時間表示では端末ごとのWebView / GPU実装差が大きいため、2時間以上の実機連続表示でフレームレート、発熱、メモリ増加、焼き付きリスクを確認してください。
