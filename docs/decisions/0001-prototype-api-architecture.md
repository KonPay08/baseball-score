# 0001. Prototype API architecture

## Status

Accepted

## Context

PROJECT.md の構成案（Hono、R2、D1、Queues、Workers AI）は未確定。AIの選定もサンプル画像の評価も終わっていない。まずは、UIから独立したAPIの入出力・エラー処理・修正・成績計算を検証できる状態を最短で作る必要がある。

## Decision

- 既存テンプレートの TanStack Start Server Routes でAPIを提供する。Hono は導入しない。
- API のロジックは `Request` → `Response` の関数にまとめ、Store と Extractor を差し替えられるようにする。
- Job はメモリに保持する。画像は保存しない。
- 解析はアップロードのリクエスト内で同期的に実行する。Job の状態モデル（processing / succeeded / failed）は、非同期化を前提にしておく。
- Extractor は固定のサンプル記録を返す `sample-fixture` とする。
- AIの抽出結果（extracted）と修正後の記録（record）を分けて保持し、成績は record からコードで計算する。
- 二重送信には `Idempotency-Key`、修正の競合には `expectedRevision` で対応する。

## Consequences

- 実際の読み取り精度・処理時間・費用はまだ検証できない。
- dev サーバーの再起動やWorkerインスタンスの切り替えで Job が消える。デプロイ環境での利用には D1 / R2 が必要。
- 実AIを入れると処理時間が延び、同期処理では限界が出る可能性が高い。その時点で Queues などへの非同期化を再検討する。
- Hono に移行する場合も、`src/server/api.ts` の関数はそのまま流用できる。
