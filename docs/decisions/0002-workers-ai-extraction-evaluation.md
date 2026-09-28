# 0002. Workers AI extraction evaluation harness

## Status

Accepted

## Context

AI の選定が未定（PROJECT.md Unknowns）。Cloudflare の無料枠を優先するため、まず Workers AI の画像対応モデルを実物のスコア表で比較したい。Cloudflare の API キーはまだ無い。

## Decision

- `src/server/workersAi.ts` に Workers AI 用の `ScoreSheetExtractor` を実装する。モデル呼び出しは `ModelRunner` 関数として注入し、評価では REST API、将来 Worker 内では AI binding を渡す。
- モデルには JSON Schema で出力形式を指定し、ドメイン外の値（未知の結果コード、範囲外の打点など）は判読不能セルに変換する。成績計算は従来どおりコードで行う。
- 評価は `pnpm eval`（`scripts/eval-extraction.ts`、tsx で実行）で行い、正解データとの照合結果を項目別に出す。「自信ありの誤り（silentError）」を別に数え、人の確認で拾えない誤りを把握する。
- 実物の画像・正解データ・評価結果は個人情報を含むため Git に含めない。
- アプリ本体の抽出器はまだ `sampleExtractor` のまま。採用モデルが決まってから AI binding（`wrangler.jsonc`）と接続する。

## Consequences

- API キーなしでも、偽のモデル応答を使ったテストと `--models sample` で仕組みを確認できる。
- 各モデルへの画像の渡し方はドキュメントに基づく想定で、実測で修正が必要になる可能性がある。
- 外部 AI（Gemini など）を比較する場合も、`ModelRunner` / 候補の定義を追加すれば同じ評価スクリプトを使える。
