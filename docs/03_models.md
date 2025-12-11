# 03. Models - データモデルとDB構造

## 📋 概要

このドキュメントは、`02_requirements.md` で定義した要件を満たすための**データベース構造**と**データモデル**を定義します。

本アプリの中核となる **「スレッド型会話モデル」** のDB構造について、設計方針から実装詳細までを分かりやすく説明します。

---

## 🎯 設計方針

### ツリー構造の表現方法

ツリー構造をRDBに載せる方法は複数ありますが、本アプリでは以下の理由から **Adjacency List（親IDを持つ方式）＋補助カラム** を採用します：

- **挿入が多い**：メッセージの追加が頻繁に発生
- **削除は少ない**：メッセージの削除は想定しない（または稀）
- **ツリーは深くない**：通常は数階層程度
- **主なクエリ**：「あるノードから上へのパス（祖先チェーン）」の取得

この要件に最適なのは **Adjacency List + `thread_root_id` + `depth`** です。

### 補助カラムの役割

- **`thread_root_id`**：ツリーの最上段メッセージを直接参照（0階層目なら自分自身）
- **`depth`**：階層の深さ（0階層目=0, 子=1, 孫=2...）
- **`created_at`**：作成日時（0階層目の並び順とコンテキスト抽出に使用）

これらの補助カラムにより、以下のクエリが効率的に実行できます：

- 0階層目メッセージの取得（`parent_message_id IS NULL`）
- ツリーの最上段メッセージの特定（`thread_root_id`）
- コンテキスト抽出（`created_at` による時間順判定）

---

## 📊 データベーススキーマ

### 0. users / auth_accounts（認証・ユーザー管理）

Remix Auth + Supabaseを前提に、ローカルDBでユーザーを管理し、認証プロバイダのユーザーIDをマッピングします。OAuthを想定し多プロバイダ対応できる形にします。

```sql
CREATE TABLE users (
  id              UUID PRIMARY KEY,
  display_name    TEXT,
  email           TEXT,              -- 必須にする場合は UNIQUE 制約を付与
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 多プロバイダ対応: provider + provider_user_id を一意に
CREATE TABLE auth_accounts (
  id                UUID PRIMARY KEY,
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider          TEXT NOT NULL,          -- e.g. 'google', 'github', 'email'
  provider_user_id  TEXT NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_user_id)
);

CREATE INDEX idx_auth_accounts_user ON auth_accounts (user_id);
```

**運用方針**:
- Supabase Authを使う場合: Supabaseの`auth.users`のUUIDを`auth_accounts.provider_user_id`として保存し、`provider='supabase'`等で識別。ローカル`users.id`と紐づけて、`conversations.user_id`はローカル`users.id`を参照。
- Remix Authのみを使う場合: 初回ログイン時に`users`行を作成し、`auth_accounts`にプロバイダIDを紐づけ。

### 1. conversations テーブル

会話セッションを管理するテーブル。メッセージを束ねる「箱」として機能します。

```sql
CREATE TABLE conversations (
  id            UUID PRIMARY KEY,
  user_id       UUID NOT NULL REFERENCES users(id),
  title         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
  -- 必要に応じてステータス、モデル設定などを追加
);

CREATE INDEX idx_conversations_user_created
  ON conversations (user_id, created_at DESC);
```

**役割**：
- 会話セッションの識別
- ユーザーごとの会話一覧取得
- メッセージのグループ化

---

### 2. messages テーブル

メッセージとツリー構造を管理するテーブル。本アプリの中核となるテーブルです。

```sql
CREATE TABLE messages (
  id              UUID PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,

  -- 親子関係（Adjacency List）
  parent_message_id UUID REFERENCES messages(id) ON DELETE CASCADE,

  -- 補助カラム：ツリー構造の効率的な操作のため
  thread_root_id   UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  depth            INT NOT NULL DEFAULT 0,

  -- メッセージ内容
  role             TEXT NOT NULL, -- 'user' | 'assistant' | 'system' など
  content          TEXT NOT NULL,

  -- 並び順用
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  sequence         BIGINT GENERATED ALWAYS AS IDENTITY, -- 任意: 安定ソート用の連番

  -- メタ情報（使用モデル、トークン数など）
  metadata         JSONB
);
```

#### カラムの説明

- **`id`**：メッセージの一意識別子
- **`conversation_id`**：所属する会話セッション
- **`parent_message_id`**：
  - `NULL`：0階層目メッセージ（最上段）
  - `NOT NULL`：親メッセージのID
- **`thread_root_id`**：
  - 0階層目メッセージ：自分自身のID（`thread_root_id = id`）
  - 子メッセージ：そのツリーの最上段メッセージのID
- **`depth`**：
  - 0階層目：`0`
  - 子メッセージ：親の `depth + 1`
- **`role`**：メッセージの役割（`user`、`assistant`、`system` など）
- **`content`**：メッセージの本文
- **`created_at`**：作成日時（0階層目の並び順とコンテキスト抽出に使用）
- **`sequence`**：安定ソート用の連番（任意、`created_at` で十分な場合は省略可）
- **`metadata`**：追加情報（使用したLLMモデル、トークン数など）

#### インデックス

```sql
-- 会話内のツリー＆親-子取得を速くする
CREATE INDEX idx_messages_conversation_root_created
  ON messages (conversation_id, thread_root_id, created_at);

CREATE INDEX idx_messages_conversation_parent_created
  ON messages (conversation_id, parent_message_id, created_at);

-- 0階層目を時間順に取る用
CREATE INDEX idx_messages_conversation_rootlevel
  ON messages (conversation_id, depth, created_at)
  WHERE depth = 0;

-- メッセージIDでの高速検索（主キーなので通常は不要だが、明示的に）
CREATE INDEX idx_messages_id ON messages (id);
```

---

## 🔍 データモデルの詳細

### 0階層目メッセージ（最上段）

**定義**：
- `parent_message_id IS NULL`
- `depth = 0`
- `thread_root_id = id`（自分自身を指す）

**取得クエリ**：

```sql
SELECT *
FROM messages
WHERE conversation_id = :conversation_id
  AND parent_message_id IS NULL
ORDER BY created_at ASC;
```

これが UI 上で `M1, M2, M3, ...` と横に並ぶ最上段メッセージです。

---

### ツリーの所属（thread_root_id）

**0階層目メッセージ**：
- `thread_root_id = id`（自分自身）
- `depth = 0`

**子孫メッセージ**：
- `thread_root_id = そのツリーの最上段メッセージID`
- `depth = 親のdepth + 1`

**例**：

```text
0階層目（最上段）
M1      M2      M3      M4      M5     ...

M2から掘ったツリー：
M2 (thread_root_id=M2, depth=0)
 ├─ M2-1 (thread_root_id=M2, depth=1)
 │    └─ M2-1-1 (thread_root_id=M2, depth=2)
 └─ M2-2 (thread_root_id=M2, depth=1)
```

---

### メッセージ作成時の処理ロジック

#### 0階層目メッセージの作成

```typescript
const newMessage = {
  id: generateUUID(),
  conversation_id: conversationId,
  parent_message_id: null,
  thread_root_id: newMessage.id,  // 自分自身
  depth: 0,
  role: 'user',
  content: userInput,
  created_at: new Date(),
};
```

#### 子メッセージの作成（親メッセージ `p` から派生）

```typescript
const parent = await getMessage(parentId);

const newMessage = {
  id: generateUUID(),
  conversation_id: parent.conversation_id,
  parent_message_id: parent.id,
  thread_root_id: parent.thread_root_id,  // 親と同じツリーの最上段
  depth: parent.depth + 1,
  role: 'user',
  content: userInput,
  created_at: new Date(),
};
```

**重要なポイント**：
- 親の `thread_root_id` をそのまま継承
- `depth` は親の `depth + 1`
- `parent_message_id` に親のIDを設定

---

## 🧩 コンテキスト抽出ロジック

`FR-3.1` の要件を満たすための、LLMに送信するコンテキストメッセージの抽出方法を説明します。

### 要件の再確認

メッセージ `m` に対するコンテキストは：

1. **ツリーの最上段メッセージ `Rk` の特定**
2. **0階層目メッセージの取得**：`Rk` の作成日時以前のものを時間順に（`[R1, R2, ..., Rk]`）
3. **祖先チェーンの取得**：`Rk` から `m` まで（`[Rk, a1, a2, ..., m]`）
4. **コンテキストの構築**：`[R1, ..., Rk]` + `[a1, ..., m]`（`Rk` は重複しない）

---

### ステップ1: 対象メッセージ `m` の情報取得

```sql
SELECT conversation_id, thread_root_id, created_at
FROM messages
WHERE id = :message_id;
```

ここで得られる `thread_root_id` が `Rk`（ツリーの最上段メッセージ）です。

同時に `Rk` の `created_at` も取得：

```sql
SELECT created_at AS root_created_at
FROM messages
WHERE id = :thread_root_id;
```

これを `root_created_at` として使用します。

---

### ステップ2: 0階層目メッセージの取得（R1〜Rk）

```sql
SELECT *
FROM messages
WHERE conversation_id = :conversation_id
  AND parent_message_id IS NULL
  AND created_at <= :root_created_at
ORDER BY created_at ASC;
```

これで `[M1, M2, ..., Rk]` が時間順に取得できます。

**重要なポイント**：
- `Rk` より後の0階層目メッセージ（`Rk+1, Rk+2, ...`）は含めない
- `created_at <= root_created_at` という条件で制限

---

### ステップ3: 祖先チェーンの取得（Rk〜m）

PostgreSQL の recursive CTE を使用：

```sql
WITH RECURSIVE ancestors AS (
  -- 基点：対象メッセージ
  SELECT *
  FROM messages
  WHERE id = :message_id

  UNION ALL

  -- 親を再帰的に取得
  SELECT m.*
  FROM messages m
  JOIN ancestors a ON m.id = a.parent_message_id
)
SELECT *
FROM ancestors
ORDER BY depth ASC;  -- depth順で並べると Rk, ..., m の順になる
```

これで `[Rk, ..., m]` の順に取得できます。

**別の方法（thread_root_id を利用）**：

```sql
SELECT *
FROM messages
WHERE thread_root_id = :thread_root_id
  AND id IN (
    WITH RECURSIVE path AS (
      SELECT id, parent_message_id
      FROM messages
      WHERE id = :message_id
      UNION ALL
      SELECT m.id, m.parent_message_id
      FROM messages m
      JOIN path p ON m.id = p.parent_message_id
    )
    SELECT id FROM path
  )
ORDER BY depth ASC;
```

---

### ステップ4: アプリ側でのコンテキスト構築

```typescript
async function getContextMessages(
  messageId: string,
  conversationId: string
): Promise<Message[]> {
  // 1. 対象メッセージとツリーの最上段を取得
  const targetMessage = await getMessage(messageId);
  const threadRootId = targetMessage.thread_root_id;
  const rootMessage = await getMessage(threadRootId);
  const rootCreatedAt = rootMessage.created_at;

  // 2. 0階層目メッセージ（R1〜Rk）を取得
  const rootsUpToK = await db.query(`
    SELECT *
    FROM messages
    WHERE conversation_id = $1
      AND parent_message_id IS NULL
      AND created_at <= $2
    ORDER BY created_at ASC
  `, [conversationId, rootCreatedAt]);

  // 3. 祖先チェーン（Rk〜m）を取得
  const ancestorChain = await db.query(`
    WITH RECURSIVE ancestors AS (
      SELECT *
      FROM messages
      WHERE id = $1
      UNION ALL
      SELECT m.*
      FROM messages m
      JOIN ancestors a ON m.id = a.parent_message_id
    )
    SELECT *
    FROM ancestors
    ORDER BY depth ASC
  `, [messageId]);

  // 4. コンテキストを構築（Rk は重複しない）
  const context = [
    ...rootsUpToK,                    // [R1, R2, ..., Rk]
    ...ancestorChain.slice(1),        // [a1, a2, ..., m] (Rkを除く)
  ];

  return context;
}
```

**最終的なコンテキストの順序**：

```text
[R1, R2, ..., Rk, a1, a2, ..., m]
```

- `R1, R2, ..., Rk`：0階層目メッセージ（時間順）
- `a1, a2, ..., m`：祖先チェーン（`Rk` を除く、depth順）

---

## 📝 具体例

### 会話構造の例

```text
0階層目（最上段）
M1      M2      M3      M4      M5     ...

M2から掘ったツリー：
M2 (id=M2, thread_root_id=M2, depth=0, created_at=T2)
 ├─ M2-1 (id=M2-1, thread_root_id=M2, depth=1, created_at=T3)
 │    └─ M2-1-1 (id=M2-1-1, thread_root_id=M2, depth=2, created_at=T4)
 └─ M2-2 (id=M2-2, thread_root_id=M2, depth=1, created_at=T5)
```

### メッセージ `M2-1-1` のコンテキスト抽出

1. **ツリーの最上段の特定**：`M2-1-1` の `thread_root_id = M2` → `Rk = M2`
2. **0階層目メッセージの取得**：`created_at <= T2` の0階層目 → `[M1, M2]`
3. **祖先チェーンの取得**：`M2-1-1` から遡る → `[M2, M2-1, M2-1-1]`
4. **コンテキストの構築**：`[M1, M2, M2-1, M2-1-1]`

**LLMに渡す順序**：

```text
1. M1         (0階層目で、M2より前のメッセージ)
2. M2         (m が属するツリーの最上段メッセージ)
3. M2-1       (ツリーの中の途中のメッセージ)
4. M2-1-1     (現在のメッセージ m)
```

**ポイント**：
- `M3, M4, M5` などの「M2より後の0階層目メッセージ」はコンテキストに含めない
- 会話全体ではなく、「`m` が属するツリーの最上段メッセージまでの0階層目」だけを含める

---

## 🔄 データ整合性の保証

### 制約とバリデーション

#### アプリケーション側での検証

メッセージ作成時には、以下の整合性を保証する必要があります：

1. **`thread_root_id` の整合性**
   - 0階層目：`thread_root_id = id`
   - 子メッセージ：`thread_root_id = 親のthread_root_id`

2. **`depth` の整合性**
   - 0階層目：`depth = 0`
   - 子メッセージ：`depth = 親のdepth + 1`

3. **`parent_message_id` の整合性**
   - 親メッセージが存在することを確認
   - 親メッセージが同じ `conversation_id` に属することを確認

#### データベース制約（将来の拡張）

必要に応じて、以下のような制約を追加できます：

```sql
-- thread_root_id が実際に0階層目メッセージを指すことを保証
ALTER TABLE messages
ADD CONSTRAINT check_thread_root_is_root
CHECK (
  (parent_message_id IS NULL AND thread_root_id = id) OR
  (parent_message_id IS NOT NULL AND thread_root_id != id)
);

-- depth の整合性（アプリ側で保証する方が柔軟）
-- データベース制約として実装する場合は、トリガーが必要
```

---

## 🚀 パフォーマンス考慮事項

### クエリ最適化

1. **インデックスの活用**
   - `conversation_id` + `thread_root_id` + `created_at` の複合インデックス
   - `conversation_id` + `parent_message_id` の複合インデックス
   - 0階層目専用の部分インデックス（`WHERE depth = 0`）

2. **再帰クエリの最適化**
   - 通常は数階層程度なので、パフォーマンス問題は発生しにくい
   - 深いツリーが予想される場合は、`thread_root_id` を活用したクエリを検討

3. **キャッシュの検討**
   - 頻繁にアクセスされる会話のツリー構造をキャッシュ
   - 0階層目メッセージの一覧をキャッシュ

---

## 📚 参考：他のツリー構造表現方法との比較

### Adjacency List（採用方式）

**メリット**：
- 挿入が簡単
- 親子関係の取得が直感的
- 補助カラム（`thread_root_id`, `depth`）で効率的なクエリが可能

**デメリット**：
- 深いツリーの祖先チェーン取得は再帰クエリが必要
- ただし、本アプリではツリーは深くないため問題なし

### Materialized Path

**特徴**：`path = '0001/0004/0007'` のように文字列で経路を持つ

**比較**：
- 本アプリの要件では、`thread_root_id` で十分
- 経路文字列は不要

### Nested Sets

**特徴**：左右の番号（`lft`/`rgt`）でツリーを表現

**比較**：
- 挿入時の更新コストが高い
- 本アプリの「挿入が多い」要件には不向き

### Closure Table

**特徴**：全ての ancestor–descendant ペアを別テーブルに保持

**比較**：
- クエリは高速だが、ストレージコストが高い
- 本アプリの要件では過剰

**結論**：Adjacency List + 補助カラムが最適 ✅

---

## 📝 このドキュメントの役割

このドキュメントは、実装時の**データベース設計の指針**として機能します。

- スキーマ定義の参照元
- クエリロジックの設計指針
- データ整合性の保証方法

実装時は、このドキュメントを参照しながら、ORM（Prisma等）のスキーマ定義やマイグレーションファイルを作成してください。


