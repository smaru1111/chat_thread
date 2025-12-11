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
│  Remix (React) + TypeScript             │
│  └─ Cloudflare Pages (ホスティング)     │
├─────────────────────────────────────────┤
│  データベース                            │
│  PostgreSQL (Supabase)                  │
│  └─ Prisma (ORM)                        │
├─────────────────────────────────────────┤
│  認証                                    │
│  Remix Auth                              │
├─────────────────────────────────────────┤
│  CI/CD                                   │
│  Cloudflare Pages (自動デプロイ)        │
│  + GitHub Actions (テスト/Lint)         │
└─────────────────────────────────────────┘
```

---

## 🖥️ フロントエンド・バックエンド

### Remix (React) + TypeScript

**選定理由**：

1. **統合型アーキテクチャ**
   - フロントエンドとバックエンドを同一リポジトリで管理
   - Loader/Actionパターンによるデータフェッチングが効率的
   - サーバーサイドとクライアントサイドの境界が明確

2. **Cloudflare Pagesとの相性**
   - RemixはCloudflare Workersランタイムをサポート
   - エッジデプロイメントによるグローバルな高速化
   - Cloudflare Pagesの自動デプロイとシームレスに統合

3. **パフォーマンス**
   - データローディングの最適化（Loaderによる並列フェッチ）
   - プログレッシブエンハンスメント
   - フォーム処理が簡単（Actionパターン）

4. **開発体験**
   - TypeScriptによる型安全性
   - Reactエコシステムの活用
   - エラーハンドリングが堅牢

5. **小規模チーム向け**
   - 学習コストが適切（Reactベース）
   - ドキュメントが充実
   - コミュニティサポートが豊富

**バージョン**：
- Remix: 2.x（最新の安定版）
- React: 18.x
- TypeScript: 5.x

---

## ☁️ ホスティング

### Cloudflare Pages

**選定理由**：

1. **Remixとの統合**
   - Remixの公式サポート（Cloudflare Workersアダプター）
   - エッジデプロイメントによる低レイテンシ
   - グローバルCDNによる高速配信

2. **デプロイの簡単さ**
   - GitHub連携による自動デプロイ（設定が簡単）
   - プレビューデプロイの自動生成（PRごと）
   - 環境変数の管理が直感的

3. **コスト効率**
   - 無料枠が充実（小規模利用には十分）
   - 従量課金が明確
   - 予期しない課金のリスクが低い

4. **パフォーマンス**
   - エッジコンピューティング（Cloudflare Workers）
   - グローバルに分散されたインフラ
   - DDoS保護などのセキュリティ機能が標準装備

5. **CI/CDの統合**
   - GitHub Actionsとの連携が簡単
   - デプロイログの確認が容易
   - ロールバック機能

**設定**：
- ビルドコマンド: `npm run build`
- ビルド出力ディレクトリ: `.output`
- Node.jsバージョン: 18.x または 20.x

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

3. **Remixとの相性**
   - Loader/Actionでの使用が自然
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

### Remix Auth

**選定理由**：

1. **Remixとの統合**
   - Remix公式の認証ソリューション
   - Loader/Actionパターンとの相性
   - セッション管理が簡単

2. **柔軟性**
   - 複数の認証プロバイダーに対応
   - カスタム認証戦略の実装が容易
   - セッションストレージの選択肢が豊富

3. **セキュリティ**
   - セッション管理が安全
   - CSRF保護
   - パスワードハッシュ化のサポート

**実装方針**：
- 初期はシンプルなメール/パスワード認証
- 必要に応じてOAuth（Google、GitHub等）を追加

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

4. **Remixとの統合**
   - 設定が簡単
   - PostCSSとの統合
   - JITモードによる高速ビルド

**バージョン**：
- Tailwind CSS: 3.x（最新の安定版）

---

## 🔄 状態管理

### Remix Loader/Action + React Hooks

**選定理由**：

1. **Remixの設計思想**
   - サーバー状態はLoaderで管理
   - クライアント状態はReact Hooksで管理
   - 追加の状態管理ライブラリが不要

2. **シンプルさ**
   - 学習コストが低い
   - ボイラープレートが少ない
   - デバッグが容易

3. **パフォーマンス**
   - 不要な再レンダリングの回避
   - データフェッチングの最適化
   - キャッシングが簡単

**必要に応じて追加**：
- React Query（複雑なキャッシングが必要な場合）
- Zustand（グローバル状態が必要な場合）

---

## 🧪 テスト

### Vitest + Testing Library

**選定理由**：

1. **モダンなテストフレームワーク**
   - Viteベースで高速
   - TypeScriptとの統合が優秀
   - ESMサポート

2. **Remixとの統合**
   - Remix Testing Utilitiesとの相性
   - サーバーサイドテストが簡単
   - Loader/Actionのテストが容易

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

2. **Cloudflare Pagesとの相性**
   - デフォルトでサポート
   - 設定が不要
   - ビルドが安定

**代替案**：
- pnpm（より高速、ディスク効率が良い）
- yarn（npmの代替）

---

## 🚀 CI/CD

### Cloudflare Pages自動デプロイ + GitHub Actions

**選定理由**：

1. **Cloudflare Pages自動デプロイ**
   - GitHub連携による自動デプロイ
   - PRごとのプレビューデプロイ
   - ロールバック機能
   - デプロイログの確認

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
      - run: npm ci
      - run: npm run typecheck
      - run: npm run lint
      - run: npm run test
```

**Cloudflare Pages設定**：
- ビルドコマンド: `npm run build`
- ビルド出力: `.output`
- 環境変数: Cloudflare Pagesダッシュボードで管理

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

### Cloudflare Analytics（初期）

**選定理由**：

1. **統合性**
   - Cloudflare Pagesと統合
   - 追加設定が不要
   - 基本的なメトリクスが取得可能

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

1. **Cloudflare Pages**
   - 環境変数の管理が簡単
   - 暗号化された保存
   - 環境ごとの設定が可能

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
   - Remix公式のESLint設定
   - TypeScript対応
   - 自動フォーマット

**設定**：
- ESLint: Remix公式設定 + TypeScript設定
- Prettier: 標準設定 + Tailwind CSSプラグイン

---

## 🎯 技術選定のまとめ

| カテゴリ | 技術 | 選定理由 |
|---------|------|---------|
| **フロントエンド** | Remix (React) | Cloudflare Pagesとの統合、統合型アーキテクチャ |
| **ホスティング** | Cloudflare Pages | Remixサポート、エッジデプロイ、無料枠 |
| **データベース** | PostgreSQL (Supabase) | マネージド、無料枠、簡単なセットアップ |
| **ORM** | Prisma | 型安全性、マイグレーション管理 |
| **認証** | Remix Auth | Remix公式、柔軟性 |
| **スタイリング** | Tailwind CSS | デファクト、開発効率 |
| **テスト** | Vitest | 高速、TypeScript統合 |
| **CI/CD** | Cloudflare Pages + GitHub Actions | 自動デプロイ、テスト自動化 |
| **LLM API** | OpenAI API | デファクト、実装の簡単さ |

---

## 🛡️ 品質・開発プロセス（Lint/Typecheck/Test/Format）

### ツールと方針
- **TypeScript**: `strict` 有効。型エラーゼロを前提。
- **ESLint**: Remix推奨設定 + TypeScript + Tailwindプラグイン。`npm run lint` をCI必須。
- **Prettier**: フォーマッタ。`npm run format` で実行。CIでは `--check`。
- **Vitest**: ユニット/結合テスト。Loader/Actionのモックテストを中心に。`npm run test`
- **Playwright（任意/後追い）**: 主要フローのE2E（認証→メッセージ投稿→分岐→LLMダミー）。
- **lint-staged + simple-git-hooks**: コミット前に `lint` / `typecheck` / `format` / `test --runInBand` を最小範囲で実行。

### 推奨 npm scripts（例）
```
"scripts": {
  "dev": "remix dev",
  "build": "remix build",
  "start": "remix-serve build",
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

### Cloudflare Pages との整合
- Cloudflare Pagesのビルド前に `typecheck` / `lint` / `test` を通すため、PRでActionsを必須チェックに。
- Pagesのビルドコマンドは `npm run build` を維持。

### レビュー運用（推奨）
- 小さなPRを推奨（UI/ロジック/DB変更は分割）
- 変更点にはスクショまたは動作GIF（UI変更時）
- API変更時は `05_api_design.md` を、モデル変更時は `03_models.md` を更新

---

## 🚀 次のステップ

この技術選定に基づいて、以下のドキュメントを参照して実装を進めます：

1. **`05_api_design.md`**：API仕様の定義
2. **`06_ui_ux.md`**：UI/UX設計

実装時は、このドキュメントを参照しながら各技術のセットアップと統合を行います。

---

## 📚 参考リンク

- [Remix公式ドキュメント](https://remix.run/docs)
- [Cloudflare Pagesドキュメント](https://developers.cloudflare.com/pages/)
- [Supabaseドキュメント](https://supabase.com/docs)
- [Prismaドキュメント](https://www.prisma.io/docs)
- [Tailwind CSSドキュメント](https://tailwindcss.com/docs)
