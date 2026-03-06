# 夜の温室 (Night Greenhouse) — 技術仕様書

**バージョン:** v2.0
**最終更新:** 2026年3月
**ステータス:** Phase 0〜3 完了・本番稼働中

---

## 目次

1. [プロジェクト概要](#1-プロジェクト概要)
2. [システムアーキテクチャ](#2-システムアーキテクチャ)
3. [機能要件](#3-機能要件)
4. [データモデル](#4-データモデル-supabase)
5. [デザイン＆UX指針](#5-デザインux指針)
6. [非機能要件](#6-非機能要件)
7. [開発チェックリスト](#7-開発チェックリスト)

---

## 1. プロジェクト概要

> 「やりたいこと」がなくてもいい。夜の独り言から、ユーザーの「OS（性質）」を再発見し、自己受容を届ける。

### 核心的価値

職業ラベルによるステレオタイプを排除し、生の「事象」と「感情」からその人固有の強みを特定する。

### 開発制約

| 項目 | 制約 | 備考 |
|------|------|------|
| 開発時間 | 週16時間 | 持続可能なペースを優先 |
| 運用コスト | 月¥10,000以内 | Supabase Free + Gemini API費用含む |

---

## 2. システムアーキテクチャ

```
ブラウザ (Next.js App Router)
  └─ Web Speech API（音声→テキスト）
       ↕ HTTP / Route Handlers
Next.js Route Handlers (API層)
       ↕ SDK
  ├─ Supabase (PostgreSQL)
  └─ Gemini 2.5 Flash (AI Engine)
```

### 技術スタック

| レイヤー | 技術 | 役割 |
|---------|------|------|
| Frontend | `Next.js 16 (App Router)` | UI・ルーティング・音声入力 |
| Backend | `Next.js Route Handlers` | APIエンドポイント・AIプロキシ |
| Database | `Supabase (PostgreSQL)` | ログ・ユーザーデータ永続化 |
| AI Engine | `Gemini 2.5 Flash` | 傾聴・分析・命名 |
| STT | `Web Speech API` | ブラウザ標準音声テキスト化 |
| デプロイ | `Vercel` | GitHub連携・自動デプロイ |

> **Web Speech API の制約:** Chrome 最新版のみ対応。Safari/Firefox はテキスト入力にフォールバック。

---

## 3. 機能要件

### 3.1 ログ記録フロー（Day 1〜6）✅

| 機能 | 説明 | 状態 |
|------|------|------|
| 感情チェックイン | 1〜10点のスコアを選択 | 完了 |
| 音声入力 | ボタン押下中に音声→テキスト化。リアルタイム表示 | 完了 |
| 案内人の応答 | 属性ラベルを剥がし、事象・感情にフォーカス。全肯定トーンで1つだけ問いを投げる | 完了 |
| 永続化 | 発言・スコア・AI返答をDBへ保存 | 完了 |
| 進捗ランプ | 7つのランプで今サイクルの記録数を表示。分析後リセット | 完了 |

### 3.2 花が咲くフェーズ（Day 7）✅

> **蓄積の原則:** 7日間のログをGeminiへ投入し「強みの断片」を抽出。分析は1サイクルに1回。結果は花として蓄積され、サイクルを重ねるごとにレベルが上がる。

**アウトプット構成：**

1. **強みの花の名称** — 独創的な二つ名の命名
2. **生存戦略（OS）** — 性質を深く肯定する解説
3. **逆照射** — 過去の苦しみを「強みの裏返し」として再定義
4. **輝ける土壌** — その性質が活きる環境条件の提示
5. **根っこ（root_elements）** — 各ログとの紐付け（具体的なエピソード逆引き）

**分析の柔軟性：**
- 1ログから複数の断片を抽出可能
- 複数ログで同じ性質が見られれば統合し、各ログ固有の root 文を生成
- 無理に件数を増やさない（明確に見えた性質だけ出力）

### 3.3 強みの庭（旧 Seed Library）✅

- **花カード一覧:** 蓄積された花をレベル順に表示
- **カード展開:** クリックで OS・逆照射・土壌・根っこ一覧を表示
- **根っこクリック:** 根拠となるログ原文（transcript）を逆引き

---

## 4. データモデル (Supabase)

### daily_logs ✅

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | プライマリキー（gen_random_uuid()） |
| `user_id` | uuid | auth.users への外部キー（RLS で保護） |
| `created_at` | timestamptz | 作成日時（now() デフォルト） |
| `week_number` | int | サイクル番号（7日間サイクルのグルーピング用） |
| `transcript` | text | ユーザーの発言テキスト |
| `emotion_score` | int | 1〜10の感情スコア（CHECK制約付き） |
| `ai_response` | text | 案内人（AI）の返答 |
| `is_analyzed` | boolean | 分析使用済みフラグ（default: false） |

### flower_collection ✅（旧 seeds_collection）

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | プライマリキー |
| `user_id` | uuid | auth.users への外部キー（RLS で保護） |
| `analyzed_at` | timestamptz | 分析実施日時 |
| `flower_name` | text | AIが命名した二つ名（旧 seed_name） |
| `os_description` | text | 性質の解説文 |
| `logic_reflection` | text | 過去の苦しみの再定義文 |
| `environment_condition` | text | 輝ける土壌の条件 |
| `level` | int | 何サイクル分この強みが抽出されたか（default: 1） |

### root_elements ✅

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | プライマリキー |
| `user_id` | uuid | auth.users への外部キー（RLS で保護） |
| `flower_id` | uuid | flower_collection への外部キー |
| `log_id` | uuid | daily_logs への外部キー |
| `root` | text | そのログでこの強みが現れた場面の要約（50字以内） |
| `created_at` | timestamptz | 作成日時 |

### user_profiles ✅

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | auth.users の ID と紐付く主キー |
| `display_name` | text | 案内人が呼びかける名前 |
| `timezone` | text | ユーザーのタイムゾーン |
| `current_cycle_id` | uuid | 現在進行中の7日間サイクルID |
| `cycle_day_count` | int | 今サイクルの完了済みログ数（1〜7） |
| `last_posted_at` | timestamp | 最終投稿日時 |
| `is_analysis_running` | boolean | 分析実行中フラグ（二重送信防止） |
| `onboarding_completed` | boolean | 初回チュートリアル完了フラグ |
| `theme_preference` | jsonb | UIカスタマイズ設定 |

> **RLS ポリシー（全テーブル共通）:**
> `auth.uid() = user_id` で SELECT / INSERT / UPDATE を制限。ユーザー間のデータ完全分離を保証。

---

## 5. デザイン＆UX指針

- **世界観:** ダークモードを基調とした「静かな夜の温室」
- **進捗表示:** 7つのランプで今サイクルの記録数を表示。分析後は0にリセット
- **心理的安全性:** 「やりたいことがなくてもいい」メッセージを各所に配置
- **花カード:** 強みを矩形カードで表示。クリックで詳細＋根っこ展開
- **根っこクリック:** 花（強み）の根拠となるエピソード・感情ログを逆引き

---

## 6. 非機能要件

### 認証・セキュリティ

| カテゴリ | 要件 | 実装方法 |
|---------|------|---------|
| 認証 | Supabase Auth（Magic Link） | メールアドレスのみ。パスワード不要 |
| データ分離 | ユーザー間のデータ完全分離 | RLS: `auth.uid() = user_id` |
| 音声プライバシー | 音声データはサーバーに送信・保存しない | Web Speech API はブラウザ内処理 |
| APIキー保護 | Gemini APIキーをクライアントに露出しない | Route Handler 経由のみ |

### コスト管理

| サービス | プラン | 月額目安 |
|---------|-------|---------|
| Supabase | Free（500MB DB） | ¥0 |
| Vercel | Hobby（個人利用） | ¥0 |
| Gemini 2.5 Flash | 従量課金 | 数十ユーザーで ¥300〜¥500 程度 |

### 対応環境

- **推奨ブラウザ:** Chrome 最新版（Web Speech API の制約）
- **フォールバック:** Safari/Firefox ではテキスト入力を提供

### デプロイ・CI/CD

| ツール | 用途 |
|-------|------|
| Vercel | Next.js ホスティング。GitHub Push → 自動デプロイ |
| GitHub | ソースコード管理・Vercel 連携済み |
| Supabase Migrations | `supabase/migrations/` でスキーマをコード管理 |

### 開発用モック

- `DEV_MOCK_AI=true` を `.env.local` に設定すると Gemini API を呼ばずにプリセット返答を返す

---

## 7. 開発チェックリスト

### Phase 0 — 基盤整備 ✅

- [x] Next.js プロジェクト作成（App Router）
- [x] Gemini API 接続確認（gemini-2.5-flash）
- [x] GitHub 連携
- [x] Supabase プロジェクト作成
- [x] Supabase Auth 設定（Magic Link）
- [x] DB マイグレーション実行（001: daily_logs / seeds_collection + RLS）
- [x] `.env.local` に環境変数追加
- [x] Vercel デプロイ設定・本番稼働

### Phase 1 — ログ記録フロー ✅

- [x] 感情スコア UI 実装（1〜10）
- [x] Web Speech API 統合（TALK/STOP ボタン）
- [x] 案内人 AI 応答実装（Gemini Route Handler）
- [x] ログ永続化（Supabase INSERT）
- [x] Supabase Auth ログイン画面実装（Magic Link）
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

### Phase 4 — 今後の候補

- [ ] アニメーション強化（Framer Motion）
- [ ] ログアウトボタン
- [ ] スマホ対応（レスポンシブ調整）
- [ ] user_profiles を活用したパーソナライズ（名前呼びかけ・タイムゾーン対応）
- [ ] 1日1回制限の実装（last_posted_at による制御）
- [ ] オンボーディング（案内人との最初の挨拶）

---

## メモ・決定事項ログ

| 日付 | 内容 |
|------|------|
| 2026-03 | Gemini モデルを `gemini-1.5-pro` → `gemini-2.5-flash` に変更（コスト削減 + API互換性） |
| 2026-03 | 認証は Magic Link のみに決定（シンプル優先） |
| 2026-03 | seeds_collection → flower_collection にリネーム。week_number 削除、level カラム追加 |
| 2026-03 | root_elements テーブル追加（花とログを多対多で紐付け） |
| 2026-03 | 分析は「1ログ1断片」の強制をやめ、統合・複数断片に対応。各ログ固有の root 文を生成 |
| 2026-03 | ランプ表示をクライアント側カウント管理に変更（分析後リセット対応） |
