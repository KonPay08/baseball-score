# Architecture

## Overview

```
Browser（簡易Web UI: src/routes/index.tsx）
↓ fetch
TanStack Start Server Routes（src/routes/api/*）
↓
API層（src/server/api.ts：入力検証・エラー・冪等性・楽観ロック）
↓
Job処理（src/server/jobs.ts）── Extractor（src/server/extractor.ts）
↓
Domain（src/features/scoresheet：モデル・要確認判定・修正・成績計算）
```

Cloudflare Workers（ローカルでは `@cloudflare/vite-plugin` 上の workerd）で動く。

## Frontend

- React / TanStack Start / Tailwind CSS
- UIはAPIを呼び出すだけで、成績計算や検証を行わない。

## Backend

- API仕様：`docs/api.md`
- `src/server/api.ts` の関数は `Request` を受け取って `Response` を返す。依存（`JobStore`、`ScoreSheetExtractor`）は引数で渡すので、Workerを起動せずにテストできる。
- 解析はアップロードのリクエスト内で同期的に行う（`docs/decisions/0001-prototype-api-architecture.md`）。

## Database

未使用。Job は Worker のメモリ上（`createMemoryJobStore`）に保持し、dev サーバーを再起動すると消える。永続化が必要になったら、`JobStore` の実装を D1 に差し替える。

## Authentication

なし（Prototype）。

## External Services

なし。AI解析は未選定。`ScoreSheetExtractor` の実装（Workers AI など）を追加して `defaultDeps.extractor` を差し替える。

## Architecture Principles

- Simple
- Replaceable
- Observable enough to debug
- Minimal dependencies
- Avoid premature abstraction
