# 05. API Design - API仕様

## 📋 概要

このドキュメントは、`02_requirements.md` の要件を満たすための API 仕様を定義します。  
Next.js（App Router） + Vercel + Supabase + Prisma 構成を前提とし、基本は JSON/HTTPS で設計します。

---

## 🔑 共通事項

- **認証**: Supabase Auth（GitHub OAuth）のセッションCookieベース（HttpOnly）。例: `Cookie: sb-...=...`
- **Base URL**: `/api`
- **Content-Type**: `application/json; charset=utf-8`
- **エラーフォーマット（例）**:
  ```json
  {
    "error": {
      "code": "VALIDATION_ERROR",
      "message": "parentMessageId is required",
      "details": {...}
    }
  }
  ```

---

## 🗂 セッション（conversations）

### POST /api/conversations
- **目的**: 新しい会話セッションを作成（FR-6.1）
- **Body**
  ```json
  { "title": "Project X" }
  ```
- **Response 201**
  ```json
  { "id": "uuid", "title": "Project X", "createdAt": "2024-01-01T00:00:00Z" }
  ```

### GET /api/conversations
- **目的**: セッション一覧取得（FR-6.2）
- **Query**: `page`, `limit`（任意）
- **Response 200**
  ```json
  { "items": [ { "id": "uuid", "title": "Project X", "createdAt": "..." } ] }
  ```

### GET /api/conversations/:id
- **目的**: セッション詳細取得（タイトルや最新更新日時）
- **Response 200**
  ```json
  { "id": "uuid", "title": "Project X", "createdAt": "...", "updatedAt": "..." }
  ```

---

## 🗨 メッセージ（messages）

### POST /api/messages
- **目的**: 新規メッセージ作成（FR-1.1, FR-2.1, FR-5.1）
- **Body**
  ```json
  {
    "conversationId": "uuid",
    "parentMessageId": "uuid | null",
    "role": "user",
    "content": "次のプランを考えて"
  }
  ```
- **処理**:
  - `parentMessageId = null` → 0階層目（thread_root_id = 自分, depth=0）
  - `parentMessageId ≠ null` → 親の `thread_root_id` を継承, depth = 親+1
- **Response 201**
  ```json
  {
    "id": "uuid",
    "conversationId": "uuid",
    "parentMessageId": null,
    "threadRootId": "uuid",
    "depth": 0,
    "role": "user",
    "content": "...",
    "createdAt": "..."
  }
  ```

### GET /api/conversations/:id/messages
- **目的**: 会話内メッセージ一覧（必要に応じて pagination / cursor）
- **Query**: `page`, `limit`, `threadRootId`（任意でツリーを絞る）
- **Response 200**
  ```json
  { "items": [ { "id": "uuid", "parentMessageId": null, "threadRootId": "uuid", "depth": 0, "role": "user", "content": "...", "createdAt": "..." } ] }
  ```

### GET /api/messages/:id/tree
- **目的**: 指定メッセージ以下のツリー取得（FR-1.2）
- **Response 200**
  ```json
  {
    "root": { "id": "uuid", "parentMessageId": null, "depth": 0, ... },
    "descendants": [
      { "id": "child-id", "parentMessageId": "uuid", "depth": 1, ... }
    ]
  }
  ```

---

## 🧭 コンテキスト取得（LLM送信用）

### GET /api/messages/:id/context
- **目的**: LLMに渡すコンテキストを取得（FR-3.1）
- **仕様**:
  - 0階層目メッセージのうち、`thread_root_id` の作成日時以前 `[R1..Rk]`
  - `Rk` から対象 `m` までの祖先チェーン `[Rk..m]`（`Rk`重複なし）
  - 順序: `[R1..Rk, a1..m]`
- **Response 200**
  ```json
  {
    "messages": [
      { "id": "R1", "role": "user", "content": "...", "createdAt": "..." },
      { "id": "Rk", "role": "user", "content": "...", "createdAt": "..." },
      { "id": "a1", "role": "assistant", "content": "...", "createdAt": "..." },
      { "id": "m", "role": "user", "content": "...", "createdAt": "..." }
    ]
  }
  ```

---

## 🤖 LLM呼び出し（推奨パターン）

### POST /api/messages/:id/complete
- **目的**: 対象メッセージを起点にLLMへ補完要求し、新規メッセージ（assistant）を生成（FR-3.2, FR-5.1）
- **処理フロー**:
  1) `/api/messages/:id/context` でコンテキスト取得  
  2) OpenAI API へ送信（ストリーミング推奨）  
  3) 生成メッセージを `messages` に保存（parent = 対象ID）  
- **Response 202 (ストリーミング開始)**:
  - SSE または fetch-stream を想定（Vercel / Node.js Runtime）

---

## 🔐 認証・ユーザー

### ログインフロー（GitHub OAuth）
- ログイン開始はフロントエンドから Supabase の OAuth フローを開始する（「GitHubでログイン」ボタン）
- OAuthコールバックは Next.js 側のルート（例: `/auth/callback`）で処理し、SupabaseセッションCookieを確立する
- API（`/api/**`）は、受け取ったCookieから「現在ユーザー」を復元してアクセス制御を行う

### POST /api/auth/logout
- **目的**: セッション無効化
- **Response 204**

### GET /api/auth/me
- **目的**: 現在ログイン中のユーザーを取得（デバッグ/UI初期化用）
- **Response 200**
  ```json
  { "user": { "id": "uuid" } }
  ```
- **Response 401**: 未ログイン

### 認証必須のアクセス制御
- すべての会話・メッセージAPIは認証必須
- `conversations.user_id` が現在のユーザーと一致しない場合は 403
- メッセージも同様に、親の会話の所有者を確認

---

## 🧪 テスト方針（APIレイヤ）

- ユニット: Route Handlers / Server Actions を Vitest でモックテスト
- 結合: Prisma をテストDB（Supabaseローカル or SQLite in-memory）で実行
- E2E: Playwright で主要フロー（セッション作成→メッセージ分岐→コンテキスト取得→LLM呼び出しダミー）

---

## 🚦 ステータスコード方針

- 200: 正常取得
- 201: 作成完了
- 202: 非同期処理開始（LLMストリーミング）
- 204: 正常（応答なし）
- 400: バリデーションエラー
- 401: 認証エラー
- 403: 権限エラー
- 404: リソースなし
- 409: 整合性違反（例: 親メッセージが別セッション）
- 500: サーバーエラー


