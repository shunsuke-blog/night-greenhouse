# 夜の温室 (Night Greenhouse) — 技術仕様書

**バージョン:** v3.0
**最終更新:** 2026年3月7日
**ステータス:** Phase 0〜4 完了・本番稼働中

---

## 目次

1. [プロジェクト概要](#1-プロジェクト概要)
2. [システムアーキテクチャ](#2-システムアーキテクチャ)
3. [機能要件](#3-機能要件)
4. [データモデル](#4-データモデル-supabase)
5. [デザイン＆UX指針](#5-デザインux指針)
6. [アニメーション仕様](#6-アニメーション仕様)
7. [非機能要件](#7-非機能要件)
8. [ファイル構成](#8-ファイル構成)
9. [開発チェックリスト](#9-開発チェックリスト)
10. [メモ・決定事項ログ](#10-メモ決定事項ログ)

---

## 1. プロジェクト概要

> 「やりたいこと」がなくてもいい。夜の独り言から、ユーザーの「OS（性質）」を再発見し、自己受容を届ける。

### 核心的価値

職業ラベルによるステレオタイプを排除し、生の「事象」と「感情」からその人固有の強みを特定する。

### 開発制約

| 項目       | 制約          | 備考                               |
| ---------- | ------------- | ---------------------------------- |
| 開発時間   | 週16時間      | 持続可能なペースを優先             |
| 運用コスト | 月¥10,000以内 | Supabase Free + Gemini API費用含む |

---

## 2. システムアーキテクチャ

```
ブラウザ (Next.js App Router)
  ├─ Web Speech API（音声→テキスト）
  ├─ Web Audio API（マイク音量取得・アニメーション連動）
  └─ Framer Motion（植物成長アニメーション）
       ↕ HTTP / Route Handlers
Next.js Route Handlers (API層)
       ↕ SDK
  ├─ Supabase (PostgreSQL + Auth)
  └─ Gemini 2.5 Flash (AI Engine)
```

### 技術スタック

| レイヤー    | 技術                      | 役割                                        |
| ----------- | ------------------------- | ------------------------------------------- |
| Frontend    | `Next.js 16 (App Router)` | UI・ルーティング・音声入力                  |
| Backend     | `Next.js Route Handlers`  | APIエンドポイント・AIプロキシ               |
| Database    | `Supabase (PostgreSQL)`   | ログ・ユーザーデータ永続化                  |
| Auth        | `Supabase Auth`           | email + password 認証。Cookie セッション管理 |
| AI Engine   | `Gemini 2.5 Flash`        | 傾聴・分析・命名（名前呼びかけ対応）        |
| STT         | `Web Speech API`          | ブラウザ標準音声テキスト化（Chrome専用）    |
| Animation   | `Framer Motion`           | 植物ステージ間トランジション・音量連動グロー |
| デプロイ    | `Vercel`                  | GitHub連携・自動デプロイ                    |

> **Web Speech API の制約:** Chrome 最新版のみ対応。Safari/Firefox はテキスト入力にフォールバック。

---

## 3. 機能要件

### 3.1 ログ記録フロー（Day 1〜6）✅

| 機能             | 説明                                                                          | 状態 |
| ---------------- | ----------------------------------------------------------------------------- | ---- |
| 感情チェックイン | 1〜10点のスコアを選択（44px タッチターゲット確保）                            | 完了 |
| 音声入力         | TALK/STOP ボタンで録音。録音中は土部分が音量に連動して発光                    | 完了 |
| 案内人の応答     | 属性ラベルを剥がし、事象・感情にフォーカス。全肯定トーンで1つだけ問いを投げる | 完了 |
| 名前呼びかけ     | display_name をプロフィールから取得し、挨拶文と AI プロンプトに反映           | 完了 |
| 永続化           | 発言・スコア・AI返答をDBへ保存。week_number はタイムゾーン対応で算出          | 完了 |
| 進捗ランプ       | 7つのランプで今サイクルの記録数を表示。分析後リセット                         | 完了 |

### 3.2 花が咲くフェーズ（Day 7）✅

> **蓄積の原則:** 7日間のログをGeminiへ投入し「強みの断片」を抽出。分析は1サイクルに1回。結果は花として蓄積され、サイクルを重ねるごとにレベルが上がる。

**アウトプット構成：**

1. **強みの花の名称** — 独創的な二つ名の命名
2. **生存戦略（OS）** — 性質を深く肯定する解説
3. **逆照射** — 過去の苦しみを「強みの裏返し」として再定義
4. **輝ける土壌** — その性質が活きる環境条件の提示
5. **根っこ（root_elements）** — 各ログとの紐付け（ログごとに固有の要約文）

**分析の柔軟性：**

- 1ログから複数の断片を抽出可能
- 複数ログで同じ性質が見られれば統合し、各ログ固有の root 文を生成
- 無理に件数を増やさない（明確に見えた性質だけ出力）

### 3.3 強みの庭（旧 Seed Library）✅

- **花カード一覧:** 蓄積された花をレベル順に表示
- **カード展開:** クリックで OS・逆照射・土壌・根っこ一覧を表示
- **根っこクリック:** 根拠となるログ原文（transcript）を逆引き

### 3.4 認証・アカウント管理 ✅

| 機能           | 説明                                                         |
| -------------- | ------------------------------------------------------------ |
| 新規登録       | display_name + email + password。登録と同時に user_profiles を upsert |
| ログイン       | email + password。エラーは日本語メッセージで表示             |
| セッション管理 | Supabase Cookie ベース（リフレッシュトークン60日）           |
| ログアウト     | 設定ページから確認ダイアログ付きでログアウト                 |
| メール確認     | ON の場合は auth/callback で user_profiles を upsert         |

### 3.5 設定ページ ✅

| 機能                 | 説明                                                    |
| -------------------- | ------------------------------------------------------- |
| 呼ばれたい名前の変更 | user_profiles.display_name を更新。変更があるときのみ保存ボタン有効 |
| メールアドレス変更   | Supabase Auth 経由で更新                                |
| パスワード変更       | 新パスワード + 確認入力。6文字以上バリデーション        |
| お問い合わせフォーム | カテゴリ（不具合報告/機能要望/その他）+ 件名 + 本文。contact_messages テーブルに保存 |
| ログアウト           | 確認ポップアップ表示後にサインアウト → /login へリダイレクト |

---

## 4. データモデル (Supabase)

### daily_logs ✅

| Column          | Type        | Description                                   |
| --------------- | ----------- | --------------------------------------------- |
| `id`            | uuid        | プライマリキー（gen_random_uuid()）            |
| `user_id`       | uuid        | auth.users への外部キー（RLS で保護）          |
| `created_at`    | timestamptz | 作成日時（UTC で保存。表示はユーザーTZ変換）   |
| `week_number`   | int         | サイクル番号（タイムゾーン対応で算出）         |
| `transcript`    | text        | ユーザーの発言テキスト                         |
| `emotion_score` | int         | 1〜10の感情スコア（CHECK制約付き）             |
| `ai_response`   | text        | 案内人（AI）の返答                             |
| `is_analyzed`   | boolean     | 分析使用済みフラグ（default: false）           |

### flower_collection ✅（旧 seeds_collection）

| Column                  | Type        | Description                                      |
| ----------------------- | ----------- | ------------------------------------------------ |
| `id`                    | uuid        | プライマリキー                                   |
| `user_id`               | uuid        | auth.users への外部キー（RLS で保護）            |
| `analyzed_at`           | timestamptz | 分析実施日時                                     |
| `flower_name`           | text        | AIが命名した二つ名（旧 seed_name）               |
| `os_description`        | text        | 性質の解説文                                     |
| `logic_reflection`      | text        | 過去の苦しみの再定義文                           |
| `environment_condition` | text        | 輝ける土壌の条件                                 |
| `level`                 | int         | 何サイクル分この強みが抽出されたか（default: 1） |

### root_elements ✅

| Column       | Type        | Description                                      |
| ------------ | ----------- | ------------------------------------------------ |
| `id`         | uuid        | プライマリキー                                   |
| `user_id`    | uuid        | auth.users への外部キー（RLS で保護）            |
| `flower_id`  | uuid        | flower_collection への外部キー                   |
| `log_id`     | uuid        | daily_logs への外部キー                          |
| `root`       | text        | そのログでこの強みが現れた場面の要約（50字以内） |
| `created_at` | timestamptz | 作成日時                                         |

### user_profiles ✅

| Column         | Type | Description                                              |
| -------------- | ---- | -------------------------------------------------------- |
| `id`           | uuid | auth.users の ID と紐付く主キー                          |
| `display_name` | text | 案内人が呼びかける名前                                   |
| `timezone`     | text | ユーザーのタイムゾーン（デフォルト: `Asia/Tokyo`）。ブラウザで自動検出・保存 |
| `created_at`   | timestamptz | 作成日時                                         |

> **RLS ポリシー（全テーブル共通）:**
> `auth.uid() = user_id`（または `id`）で SELECT / INSERT / UPDATE を制限。ユーザー間のデータ完全分離を保証。

### contact_messages ✅

| Column       | Type        | Description                               |
| ------------ | ----------- | ----------------------------------------- |
| `id`         | uuid        | プライマリキー                            |
| `user_id`    | uuid        | auth.users への外部キー（RLS で保護）     |
| `category`   | text        | 不具合報告 / 機能要望 / その他            |
| `subject`    | text        | 件名                                      |
| `message`    | text        | 本文                                      |
| `created_at` | timestamptz | 送信日時                                  |

### マイグレーションファイル一覧

| ファイル                         | 内容                                                 |
| -------------------------------- | ---------------------------------------------------- |
| `001_initial_schema.sql`         | daily_logs / seeds_collection + RLS                  |
| `002_flower_schema.sql`          | flower_collection へのリネーム、root_elements 追加   |
| `003_contact_messages.sql`       | contact_messages テーブル + RLS                      |
| `004_user_profiles.sql`          | user_profiles テーブル + RLS                         |
| `005_user_profiles_timezone.sql` | user_profiles に timezone カラム追加                 |

---

## 5. デザイン＆UX指針

### レイアウト原則

- **モバイルファースト:** `px-4 sm:px-6` パターンで全ページ統一。水平余白の調整は1箇所で完結
- **コンテナ幅:** `w-full max-w-{size} mx-auto` パターンを全ページで使用
- **スマートフォン対応:** タッチターゲット最低 44px（`h-11`）。iOS ホームバー考慮（`bottom-8`）
- **ブレークポイント:** `sm:` (640px) に統一

### ホーム画面レイアウト（上から順）

1. タイトル「夜の温室」+ ⚙ 設定ボタン（右端揃え）
2. 進捗ランプ（7個。サイクル内ログ数をカウント）
3. AI メッセージボックス（コンパクト: `min-h-[72px] p-4`）
4. 植物アニメーション（成長ステージ）
5. Day7 分析ボタン（条件付き表示）
6. 感情スコア選択（1〜10）
7. TALK ボタン
8. 発話テキスト（録音後に表示）
9. 強みの庭ボタン（右下固定: `fixed bottom-8 right-4 sm:right-6`）

### カラーパレット

| 役割                 | Tailwind クラス / HEX              |
| -------------------- | ---------------------------------- |
| 背景                 | `slate-950` (#0f172a)              |
| メインテキスト       | `slate-200`                        |
| アクセント（緑）     | `emerald-400` (#34d399)            |
| 葉・茎               | `emerald-400` / `emerald-950` fill |
| 花びら（7日目）      | `rose-300` (#fda4af) ストローク    |
| 花の中心             | `rose-400` (#fb7185)               |
| 土グロー             | `emerald-300` (#6ee7b7)            |

---

## 6. アニメーション仕様

### 植物成長ステージ（`components/PlantAnimation.tsx`）

| `cycleLogCount` | ステージ   | 表示内容                               |
| --------------- | ---------- | -------------------------------------- |
| 0               | `soil`     | 盛り上がった土のみ                     |
| 1               | `sprout`   | 短い茎 + 丸い芽                        |
| 2–3             | `seedling` | 茎 + 双葉 + 小さな蕾                  |
| 4–5             | `grown`    | 茎 + 4枚の葉 + 蕾                     |
| 6–7             | `bud`      | 茎 + 4枚の葉 + 萼付き大きな蕾         |
| 分析後          | `flower`   | 茎 + 葉 + ローズ系6枚花びら + 中心    |

**実装詳細:**
- SVG ミニマル線画（viewBox: `0 0 120 160`）
- Framer Motion `AnimatePresence mode="wait"` でステージ間をフェード遷移（duration: 0.55s）
- カラーは `C`（植物全般）と `FC`（花びら専用・ローズ系）の2定数で管理

### 音量連動グロー（録音中）

- Web Audio API（`AudioContext` + `AnalyserNode`）でマイク音量をリアルタイム計測
- `useMotionValue` → `useSpring`（damping: 18, stiffness: 200）でスムーズに平滑化
- `useTransform` で opacity に変換: 入力 `[0, 0.2]` → 出力 `[0, 0.88]`
- 土の背後に emerald-300 グロー楕円（`rx=72 ry=24 blur=30px`）を描画
- 録音停止時に rawVolume を 0 にリセット

**調整パラメータ（`PlantAnimation.tsx` 55行目付近）:**
```
const opacity = useTransform(volume, [0, 0.2], [0, 0.88]);
// [0, 0.2]: 入力レンジ（小さいほど敏感）
// [0, 0.88]: 出力レンジ（大きいほど明るい）
// グロー楕円サイズ: rx="72" ry="24" / blur: "30px"
```

---

## 7. 非機能要件

### 認証・セキュリティ

| カテゴリ         | 要件                                     | 実装方法                              |
| ---------------- | ---------------------------------------- | ------------------------------------- |
| 認証             | Supabase Auth（email + password）        | 新規登録・ログイン。Cookie セッション |
| データ分離       | ユーザー間のデータ完全分離               | RLS: `auth.uid() = user_id`           |
| 音声プライバシー | 音声データはサーバーに送信・保存しない   | Web Speech API はブラウザ内処理       |
| APIキー保護      | Gemini APIキーをクライアントに露出しない | Route Handler 経由のみ                |

### コスト管理

| サービス         | プラン            | 月額目安                       |
| ---------------- | ----------------- | ------------------------------ |
| Supabase         | Free（500MB DB）  | ¥0                             |
| Vercel           | Hobby（個人利用） | ¥0                             |
| Gemini 2.5 Flash | 従量課金          | 数十ユーザーで ¥300〜¥500 程度 |

### 対応環境

- **推奨ブラウザ:** Chrome 最新版（Web Speech API の制約）
- **フォールバック:** Safari/Firefox ではテキスト入力を提供
- **スマートフォン:** iOS Safari / Android Chrome 対応。レスポンシブ実装済み

### タイムゾーン対応

- `daily_logs.created_at` は UTC で保存（Supabase デフォルト）
- ブラウザで `Intl.DateTimeFormat().resolvedOptions().timeZone` を検出し `user_profiles.timezone` に自動保存
- API 側（`/api/logs`, `/api/status`）で `lib/date-utils.ts` の `calcWeekNumber()` を使い、ユーザーの暦日ベースで week_number を算出
- JST深夜0〜9時（UTC前日15〜24時）のログも正しく当日として扱われる

### デプロイ・CI/CD

| ツール              | 用途                                             |
| ------------------- | ------------------------------------------------ |
| Vercel              | Next.js ホスティング。GitHub Push → 自動デプロイ |
| GitHub              | ソースコード管理・Vercel 連携済み                |
| Supabase Migrations | `supabase/migrations/` でスキーマをコード管理    |

### 開発用モック

- `DEV_MOCK_AI=true` を `.env.local` に設定すると Gemini API を呼ばずにプリセット返答を返す

---

## 8. ファイル構成

```
app/
  page.tsx                  # メイン画面（ログ記録・植物・感情スコア・TALK）
  login/page.tsx            # ログイン・新規登録（email + password）
  settings/page.tsx         # 設定ページ（名前・メール・パスワード・お問い合わせ・ログアウト）
  seeds/page.tsx            # 強みの庭（花カード一覧・詳細展開）
  auth/callback/route.ts    # メール確認後のコールバック（user_profiles upsert）
  api/
    logs/route.ts           # ログ保存 + AI 返答生成（タイムゾーン対応・名前呼びかけ）
    status/route.ts         # 週次ステータス取得（タイムゾーン対応）
    analyze/route.ts        # 7日分析実行（Gemini）
    flowers/route.ts        # 花コレクション取得
    contact/route.ts        # お問い合わせ送信

components/
  PlantAnimation.tsx        # 植物SVGアニメーション（6ステージ + 音量グロー）

lib/
  supabase.ts               # ブラウザ用 Supabase クライアント
  supabase-server.ts        # サーバー用 Supabase クライアント（@supabase/ssr）
  prompts.ts                # AI プロンプト定数（GUIDE_SYSTEM_PROMPT は displayName 引数あり）
  date-utils.ts             # タイムゾーン対応日付計算ユーティリティ

middleware.ts               # 認証ガード（未ログイン → /login リダイレクト）

supabase/migrations/
  001_initial_schema.sql
  002_flower_schema.sql
  003_contact_messages.sql
  004_user_profiles.sql
  005_user_profiles_timezone.sql
```

---

## 9. 開発チェックリスト

### Phase 0 — 基盤整備 ✅

- [x] Next.js プロジェクト作成（App Router）
- [x] Gemini API 接続確認（gemini-2.5-flash）
- [x] GitHub 連携
- [x] Supabase プロジェクト作成
- [x] Supabase Auth 設定
- [x] DB マイグレーション実行（001〜005）
- [x] `.env.local` に環境変数追加
- [x] Vercel デプロイ設定・本番稼働

### Phase 1 — ログ記録フロー ✅

- [x] 感情スコア UI 実装（1〜10、タッチターゲット 44px）
- [x] Web Speech API 統合（TALK/STOP ボタン）
- [x] 案内人 AI 応答実装（Gemini Route Handler）
- [x] ログ永続化（Supabase INSERT）
- [x] middleware.ts による認証ガード
- [x] DEV_MOCK_AI モード実装（API節約）

### Phase 2 — 花が咲くフェーズ ✅

- [x] サイクル判定ロジック（is_analyzed フラグ確認・分析済みなら409）
- [x] 7日間ログ取得 → Gemini 統合分析（FRAGMENT_ANALYZE_PROMPT）
- [x] 柔軟な断片数（統合・複数可）、ログごとに固有の root 文を生成
- [x] flower_collection / root_elements への保存
- [x] 分析後ランプリセット（クライアント側カウント管理）

### Phase 3 — 強みの庭 ✅

- [x] 花コレクション一覧 UI（レベル順カード表示）
- [x] カードクリック → OS・逆照射・土壌・根っこ一覧展開
- [x] 根っこクリック → 元ログ transcript 逆引き

### Phase 4 — アカウント・UX強化 ✅

- [x] email + password による新規登録 & ログイン
- [x] 新規登録時に user_profiles へ upsert（即時セッション / メール確認 両対応）
- [x] ログアウト（設定ページから確認ダイアログ付き）
- [x] 設定ページ（名前・メール・パスワード変更。変更検知で保存ボタン制御）
- [x] お問い合わせフォーム（カテゴリ + 件名 + 本文）
- [x] スマホ対応（モバイルファースト・全ページレスポンシブ）
- [x] 植物アニメーション（6ステージ成長。Framer Motion SVG）
- [x] 音量連動グロー（Web Audio API + MotionValue。土部分がエメラルド色に発光）
- [x] パーソナライズ（名前呼びかけ: UI + AI プロンプト両方）
- [x] タイムゾーン対応（ブラウザ自動検出・保存。week_number 算出に使用）

### Phase 5 — 今後の候補

- [ ] 1日1回制限の実装（last_posted_at による制御）
- [ ] オンボーディング（案内人との最初の挨拶）
- [ ] カレンダー機能（過去ログの日付ブラウズ）
- [ ] テキスト入力フォールバック（Safari/Firefox 対応）
- [ ] プッシュ通知（毎晩のリマインダー）

---

## 10. メモ・決定事項ログ

| 日付       | 内容                                                                                    |
| ---------- | --------------------------------------------------------------------------------------- |
| 2026-03-01 | Gemini モデルを `gemini-1.5-pro` → `gemini-2.5-flash` に変更（コスト削減 + API互換性）  |
| 2026-03-02 | seeds_collection → flower_collection にリネーム。week_number 削除、level カラム追加     |
| 2026-03-03 | root_elements テーブル追加（花とログを多対多で紐付け）                                  |
| 2026-03-03 | 分析は「1ログ1断片」の強制をやめ、統合・複数断片に対応。各ログ固有の root 文を生成      |
| 2026-03-03 | ランプ表示をクライアント側カウント管理に変更（分析後リセット対応）                      |
| 2026-03-04 | 認証を Magic Link → email + password に変更。user_profiles 登録フロー追加               |
| 2026-03-04 | 設定ページ新設（/settings）。変更検知・確認ダイアログ・お問い合わせフォーム実装         |
| 2026-03-05 | スマホ対応（モバイルファーストのレスポンシブ実装）。感情スコアボタンタッチターゲット改善 |
| 2026-03-06 | 植物成長アニメーション実装（framer-motion + SVG。6ステージ）                            |
| 2026-03-06 | 花びらをローズ系カラーに変更。音量連動グロー（Web Audio API + SoilGlow コンポーネント） |
| 2026-03-07 | タイムゾーン対応（lib/date-utils.ts）。JST深夜ログのズレ修正                            |
| 2026-03-07 | パーソナライズ実装（名前呼びかけ: デフォルト挨拶文 + Gemini プロンプト両方）            |
| 2026-03-07 | user_profiles.timezone をブラウザで自動検出・保存するよう実装                           |
