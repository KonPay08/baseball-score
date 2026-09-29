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

- 選手名簿だけ D1（binding `DB`、テーブル `players`）に保存する（`src/server/roster.ts`）。テーブルは初回アクセス時に `CREATE TABLE IF NOT EXISTS` で作る。`DB` binding が無い環境ではメモリ上の名簿を使う。
- Job は Worker のメモリ上（`createMemoryJobStore`）に保持し、dev サーバーを再起動すると消える。
- 判断は `docs/decisions/0005-roster-matching.md`。

## Authentication

なし（Prototype）。

## External Services

AI解析のモデルは未選定（評価待ち）。アプリの抽出器は Worker の環境変数でリクエストごとに選ぶ（`src/server/extractorConfig.ts`、`src/server/runtime.ts`）。優先順は OpenAI → Workers AI → `sampleExtractor`。

| 環境変数 | 内容 |
| --- | --- |
| `OPENAI_API_KEY` | あれば OpenAI Responses API で読み取る（`src/server/openai.ts`）。Workers AI より優先。 |
| `OPENAI_MODEL` | 任意。`OPENAI_VISION_CANDIDATES` のモデル名。未指定は暫定で `gpt-5.6-terra`。候補外の値は解析失敗になる。 |
| `CLOUDFLARE_ACCOUNT_ID` / `CLOUDFLARE_API_TOKEN` | 両方あれば Workers AI の REST API で読み取る。どちらかが無ければ `sampleExtractor`。 |
| `WORKERS_AI_MODEL` | 任意。`WORKERS_AI_VISION_CANDIDATES` のモデル名。未指定は暫定で `@cf/meta/llama-4-scout-17b-16e-instruct`。候補外の値は解析失敗になる。 |

- Workers AI の抽出器（`src/server/workersAi.ts`）と評価スクリプト（`pnpm eval`）の手順は `docs/evaluation.md`、判断は `docs/decisions/0002-workers-ai-extraction-evaluation.md`、`0003-select-extractor-from-env.md`、`0004-openai-extractor.md`。

## Architecture Principles

- Simple
- Replaceable
- Observable enough to debug
- Minimal dependencies
- Avoid premature abstraction
