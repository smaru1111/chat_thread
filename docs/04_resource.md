# 04. Resource - 技術選定とリソース構成

## 📋 概要

このドキュメントは、`02_requirements.md` で定義した要件を満たすための**技術スタック**と**リソース選定**を定義します。

本アプリの技術選定方針は以下の通りです：

- **デプロイが簡単**：webサーバ、DB、APIサーバなどのデプロイが容易
- **CI/CDが簡単**：自動化されたデプロイパイプライン
- **小規模向け**：数人規模での利用を想定
- **モダンでデファクトスタンダード**：最新の技術トレンドに沿った選択

---

## 🎯 技術スタック全体像

```
┌─────────────────────────────────────────┐
│  フロントエンド + バックエンド           │
│  Next.js (App Router) + TypeScript      │
│  └─ Vercel (ホスティング)               │
├─────────────────────────────────────────┤
│  データベース                            │
│  PostgreSQL (Supabase)                  │
│  └─ Prisma (ORM)                        │
├─────────────────────────────────────────┤
│  認証                                    │
│  Supabase Auth（GitHub OAuthのみ）       │
├─────────────────────────────────────────┤
│  CI/CD                                   │
│  Vercel (自動デプロイ)                   │
│  + GitHub Actions (テスト/Lint)         │
└─────────────────────────────────────────┘
```

---

## 🖥️ フロントエンド・バックエンド

### Next.js（App Router） + TypeScript

**選定理由**：

1. **統合型アーキテクチャ**
   - フロントエンドとバックエンドを同一リポジトリで管理
   - Server Components / Route Handlers により、SSRとAPI実装を同一アプリで完結できる
   - サーバーサイドとクライアントサイドの境界が明確（RSC / Client Component）

2. **Vercelとの相性**
   - Next.jsはVercelのファーストパーティ
   - Node.jsランタイムでPrismaがそのまま動作
   - Vercelの自動デプロイとシームレスに統合

3. **パフォーマンス**
   - サーバー側でのデータ取得（RSC）とストリーミング
   - プログレッシブエンハンスメント
   - フォーム処理は Server Actions / Route Handlers を選べる

4. **開発体験**
   - TypeScriptによる型安全性
   - Reactエコシステムの活用
   - エラーハンドリングが堅牢

5. **小規模チーム向け**
   - 学習コストが適切（Reactベース）
   - ドキュメントが充実
   - コミュニティサポートが豊富

**バージョン**：
- Next.js: 15.x（安定版）
- React: 18.x
- TypeScript: 5.x

---

## ☁️ ホスティング

### Vercel

**選定理由**：

1. **Next.jsとの統合**
   - Next.jsの公式サポート（自動検出・最適化）
   - Node.jsランタイムでPrismaがそのまま動作
   - サーバーレス関数として自動デプロイ

2. **デプロイの簡単さ**
   - GitHub連携による自動デプロイ（設定が簡単）
   - プレビューデプロイの自動生成（PRごと）
   - 環境変数の管理が直感的（ダッシュボード + CLI）

3. **コスト効率**
   - 無料枠が充実（小規模利用には十分）
   - 従量課金が明確（Hobbyプランで十分）
   - 予期しない課金のリスクが低い

4. **パフォーマンス**
   - グローバルCDNによる高速配信
   - エッジネットワークによる低レイテンシ
   - 自動的な最適化（画像最適化、圧縮等）

5. **CI/CDの統合**
   - GitHub連携による自動デプロイ
   - デプロイログの確認が容易
   - ロールバック機能
   - 環境ごとの設定（Production/Preview/Development）

6. **Prismaとの相性**
   - Node.jsランタイムでPrisma Clientがそのまま動作
   - データベース接続プーリングが利用可能
   - マイグレーション実行が容易

**設定**：
- ビルドコマンド: `npm run build`（自動検出）
- フレームワーク: Next.js（自動検出）
- Node.jsバージョン: 18.x または 20.x（自動検出）

---

## 🗄️ データベース

### PostgreSQL (Supabase)

**選定理由**：

1. **Supabaseの利点**
   - PostgreSQLを完全マネージドで提供
   - 無料枠が充実（小規模利用に十分）
   - ダッシュボードによる管理が簡単
   - リアルタイム機能（将来の拡張に備える）

2. **デプロイの簡単さ**
   - セットアップが数分で完了
   - 接続情報の管理が簡単
   - バックアップが自動

3. **スケーラビリティ**
   - 小規模から中規模まで対応
   - 必要に応じてプランアップが容易
   - パフォーマンスが予測可能

4. **開発体験**
   - ローカル開発環境（Supabase CLI）
   - マイグレーション管理が簡単
   - データベースブラウザが標準装備

**代替案**：
- Railway（PostgreSQL + アプリ統合）
- Neon（サーバーレスPostgreSQL）

---

## 🔧 ORM

### Prisma

**選定理由**：

1. **デファクトスタンダード**
   - TypeScriptとの統合が優秀
   - 型安全なクエリビルダー
   - マイグレーション管理が簡単

2. **開発体験**
   - Prisma Studioによるデータ確認
   - スキーマ定義が直感的
   - 自動生成される型定義

3. **Next.jsとの相性**
   - Route Handlers / Server Actions / Server Components での利用が自然
   - サーバーサイドでの実行に最適
   - エラーハンドリングが明確

4. **パフォーマンス**
   - クエリの最適化
   - 接続プーリング
   - プリペアドステートメント

**バージョン**：
- Prisma: 5.x（最新の安定版）

---

## 🔐 認証

### Supabase Auth（GitHub OAuthのみ） + `@supabase/ssr`

**選定理由**：

1. **Next.js（SSR）との統合**
   - `@supabase/ssr` により、SSR/Route Handlers でCookieからユーザー復元ができる
   - HttpOnly Cookieベースのセッション管理が容易

2. **柔軟性**
   - Supabase側でOAuthプロバイダー追加が可能（将来拡張）
   - 認証とDB（Postgres）を同一基盤で扱える

3. **セキュリティ**
   - OAuth（GitHub）に限定し、資格情報管理（パスワード保管）を不要にする
   - Cookie属性（HttpOnly / Secure / SameSite）を適切に設定

**実装方針**：
- 初期は **GitHub OAuthのみ**
- GitHub OAuth の Client ID / Secret は **Supabase側（Auth Providers設定）** で管理

---

## 🎨 スタイリング

### Tailwind CSS

**選定理由**：

1. **デファクトスタンダード**
   - モダンなWeb開発の標準
   - コミュニティが大きい
   - ドキュメントが充実

2. **開発効率**
   - ユーティリティファーストのアプローチ
   - カスタムデザインの実装が簡単
   - レスポンシブデザインが容易

3. **パフォーマンス**
   - 未使用のCSSの自動削除（PurgeCSS）
   - バンドルサイズの最適化
   - ビルド時の最適化

4. **Next.jsとの統合**
   - 設定が簡単
   - PostCSSとの統合
   - JITモードによる高速ビルド

**バージョン**：
- Tailwind CSS: 3.x（最新の安定版）

---

## 🧩 UIコンポーネント

### shadcn/ui（推奨）

**選定理由**：

1. **必要な分だけ導入できる**
   - “ライブラリ依存”というより「コンポーネントをプロジェクトに取り込む」方式
   - 将来的なカスタマイズ（スレッド表示など独自UI）と相性が良い

2. **Tailwindと相性が良い**
   - 既存の Tailwind 方針を崩さずに、フォーム/ボタン/ダイアログ等の土台が揃う

3. **アクセシビリティ基盤**
   - Radix UIベースのため、Dialog/Popover/Tooltip/Dropdown等が安定

**運用方針**：
- 見た目は `shadcn/ui` のデフォルトを基本とし、**Slack“風”の見た目には寄せない**
- Slackは **UI配置（中央＝メイン、右＝スレッド）** の参考として扱う

**必要に応じて追加**（任意）：
- `cmdk`: コマンドパレット（Cmd+K）でセッション/スレッド検索を実装したい場合

---

## 🔄 状態管理

### Server Components（RSC） + React Hooks（必要に応じて TanStack Query）

**選定理由**：

1. **Next.jsの設計に沿う**
   - 初期データは Server Components で取得（SSR）
   - ユーザー操作（投稿/分岐/ストリーミング表示）は Client Component で扱う

2. **シンプルさ**
   - 学習コストが低い
   - ボイラープレートが少ない
   - デバッグが容易

3. **パフォーマンス**
   - 不要な再レンダリングの回避
   - データフェッチングの最適化
   - キャッシングが簡単

**必要に応じて追加**：
- TanStack Query（複雑なキャッシングが必要な場合）
- Zustand（グローバル状態が必要な場合）

---

## 🧪 テスト

### Vitest + Testing Library

**選定理由**：

1. **モダンなテストフレームワーク**
   - Viteベースで高速
   - TypeScriptとの統合が優秀
   - ESMサポート

2. **Next.jsとの統合**
   - Route Handlers / サーバー関数をユニットテストしやすい
   - UIは Testing Library でコンポーネントテスト可能

3. **開発体験**
   - ウォッチモードが高速
   - カバレッジレポート
   - スナップショットテスト

**バージョン**：
- Vitest: 1.x
- @testing-library/react: 14.x
- @testing-library/jest-dom: 6.x

---

## 📦 パッケージマネージャー

### npm

**選定理由**：

1. **標準的**
   - Node.jsに標準装備
   - 追加のインストールが不要
   - 互換性が高い

2. **標準的な採用**
   - CI/CD（GitHub Actions）やVercelで安定して動作
   - 初期導入コストが低い

**代替案**：
- pnpm（より高速、ディスク効率が良い）
- yarn（npmの代替）

---

## 🚀 CI/CD

### Vercel自動デプロイ + GitHub Actions

**選定理由**：

1. **Vercel自動デプロイ**
   - GitHub連携による自動デプロイ（設定不要）
   - PRごとのプレビューデプロイ
   - ロールバック機能
   - デプロイログの確認
   - 環境ごとの設定（Production/Preview/Development）

2. **GitHub Actions**
   - テストとLintの自動実行
   - 型チェックの自動実行
   - ビルドの検証

**ワークフロー**：

```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run typecheck
      - run: npm run lint
      - run: npm run test
```

**Vercel設定**：
- ビルドコマンド: `npm run build`（自動検出）
- フレームワーク: Next.js（自動検出）
- 環境変数: Vercelダッシュボードで管理
  - Production環境
  - Preview環境
  - Development環境（ローカル開発用）

---

## 🔌 LLM API統合

### OpenAI API（初期）

**選定理由**：

1. **デファクトスタンダード**
   - 最も広く使われているLLM API
   - ドキュメントが充実
   - コミュニティサポートが豊富

2. **実装の簡単さ**
   - REST APIによる統合
   - ストリーミングレスポンスのサポート
   - エラーハンドリングが明確

3. **拡張性**
   - 複数のモデルに対応（GPT-4、GPT-3.5等）
   - 将来のモデルアップデートに対応
   - カスタマイズオプション

**実装方針**：
- 抽象化レイヤーを用意（`LLMProvider`インターフェース）
- 将来的にAnthropic、Google等への切り替えが容易

**代替案**：
- Anthropic Claude API
- Google Gemini API
- オープンソースLLM（Ollama等）

---

## 📊 監視・ログ

### Vercel Analytics（初期）

**選定理由**：

1. **統合性**
   - Vercelと統合
   - 追加設定が不要
   - 基本的なメトリクスが取得可能（Web Vitals等）

2. **コスト**
   - 無料枠で基本的な監視が可能
   - 小規模利用には十分

**将来の拡張**：
- Sentry（エラー追跡）
- Logtail（ログ管理）
- Datadog（本格的な監視）

---

## 🔒 セキュリティ

### 環境変数管理

**選定理由**：

1. **Vercel**
   - 環境変数の管理が簡単（ダッシュボード + CLI）
   - 暗号化された保存
   - 環境ごとの設定が可能（Production/Preview/Development）

2. **開発環境**
   - `.env`ファイルによる管理
   - `.env.example`によるテンプレート
   - シークレットの漏洩防止

**管理方針**：
- APIキーは環境変数で管理
- コードにハードコードしない
- `.gitignore`で`.env`を除外

---

## 📝 開発ツール

### ESLint + Prettier

**選定理由**：

1. **コード品質**
   - 一貫したコードスタイル
   - バグの早期発見
   - チーム開発での統一

2. **Remixとの統合**
   - Next.js推奨のESLint設定
   - TypeScript対応
   - 自動フォーマット

**設定**：
- ESLint: Next.js推奨設定 + TypeScript設定
- Prettier: 標準設定 + Tailwind CSSプラグイン

---

## 🎯 技術選定のまとめ

| カテゴリ | 技術 | 選定理由 |
|---------|------|---------|
| **フロントエンド** | Next.js（App Router） | 統合型アーキテクチャ、SSR/RSC、Vercelとの相性 |
| **ホスティング** | Vercel | Next.jsファーストパーティ、Prisma動作、無料枠 |
| **データベース** | PostgreSQL (Supabase) | マネージド、無料枠、簡単なセットアップ |
| **ORM** | Prisma | 型安全性、マイグレーション管理 |
| **認証** | Supabase Auth（GitHub OAuthのみ） | OAuthに限定して資格情報管理を不要化、SSR連携が容易 |
| **スタイリング** | Tailwind CSS | デファクト、開発効率 |
| **テスト** | Vitest | 高速、TypeScript統合 |
| **CI/CD** | Vercel + GitHub Actions | 自動デプロイ、テスト自動化 |
| **LLM API** | OpenAI API | デファクト、実装の簡単さ |

---

## 🛡️ 品質・開発プロセス（Lint/Typecheck/Test/Format）

### ツールと方針
- **TypeScript**: `strict` 有効。型エラーゼロを前提。
- **ESLint**: Next.js推奨設定 + TypeScript + Tailwindプラグイン。`npm run lint` をCI必須。
- **Prettier**: フォーマッタ。`npm run format` で実行。CIでは `--check`。
- **Vitest**: ユニット/結合テスト。Route Handlers / サーバー関数のテストを中心に。`npm run test`
- **Playwright（任意/後追い）**: 主要フローのE2E（認証→メッセージ投稿→分岐→LLMダミー）。
- **lint-staged + simple-git-hooks**: コミット前に `lint` / `typecheck` / `format` / `test --runInBand` を最小範囲で実行。

### 推奨 npm scripts（例）
```
"scripts": {
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "eslint . --ext ts,tsx",
  "format": "prettier --write .",
  "format:check": "prettier --check .",
  "typecheck": "tsc --noEmit",
  "test": "vitest run",
  "test:watch": "vitest watch"
}
```

### CI（GitHub Actions）で必須とするジョブ
1. `npm run typecheck`
2. `npm run lint`
3. `npm run format:check`
4. `npm run test`（将来的にE2Eを追加）

### Vercel との整合
- Vercelのビルド前に `typecheck` / `lint` / `test` を通すため、PRでActionsを必須チェックに。
- Vercelのビルドコマンドは `npm run build` を維持（自動検出）。

### レビュー運用（推奨）
- 小さなPRを推奨（UI/ロジック/DB変更は分割）
- 変更点にはスクショまたは動作GIF（UI変更時）
- API変更時は `05_api_design.md` を、モデル変更時は `03_models.md` を更新

---

## 🔧 Vercel環境変数の設定方法

### 1. Vercelダッシュボードでの設定

1. **Vercelダッシュボードにアクセス**
   - https://vercel.com/dashboard にログイン
   - プロジェクトを選択（または新規作成）

2. **環境変数の追加**
   - プロジェクトの「Settings」→「Environment Variables」を開く
   - 「Add New」をクリック

3. **必要な環境変数を追加**
   - `DATABASE_URL`: PostgreSQL接続文字列（Supabaseから取得）
   - `NEXT_PUBLIC_SUPABASE_URL`: SupabaseプロジェクトURL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Supabase anon公開キー
   - `OPENAI_API_KEY`: OpenAI APIキー
   - （注）GitHub OAuthのClient ID / Secret は Supabase 側（Auth Providers設定）で管理する

4. **環境ごとの設定**
   - Production: 本番環境用の値
   - Preview: プレビュー環境用の値（PRごとに生成）
   - Development: ローカル開発用の値（`.env`ファイルで管理）

### 2. ローカル開発環境（`.env`ファイル）

プロジェクトルートに `.env` ファイルを作成：

```env
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/postgres?sslmode=require
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
OPENAI_API_KEY=sk-...
```

**注意**: `.env` ファイルは `.gitignore` に含まれているため、Gitにコミットされません。

### 3. GitHub Secrets（CI/CD用）

GitHub Actionsでテストを実行する場合、以下のシークレットを設定：

1. リポジトリの「Settings」→「Secrets and variables」→「Actions」
2. 「New repository secret」をクリック
3. 上記の環境変数を追加（`DATABASE_URL`, `SUPABASE_URL`等）

または、GitHub Environments（`dev`環境）を使用している場合は、その環境にシークレットを設定。

---

## 🚀 次のステップ

この技術選定に基づいて、以下のドキュメントを参照して実装を進めます：

1. **`05_api_design.md`**：API仕様の定義
2. **`06_ui_ux.md`**：UI/UX設計

実装時は、このドキュメントを参照しながら各技術のセットアップと統合を行います。

---

## 📚 参考リンク

- [Next.js公式ドキュメント](https://nextjs.org/docs)
- [Vercel Next.jsドキュメント](https://vercel.com/docs/frameworks/nextjs)
- [Supabaseドキュメント](https://supabase.com/docs)
- [Prismaドキュメント](https://www.prisma.io/docs)
- [Tailwind CSSドキュメント](https://tailwindcss.com/docs)
