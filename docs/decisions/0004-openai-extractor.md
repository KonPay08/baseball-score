# 0004. OpenAI extractor

## Status

Accepted

## Context

Workers AI のモデルでは、実際のスコア表の読み取り精度が足りなかった（ユーザーによる確認）。ユーザーは OpenAI API を次の比較対象に選んだ。

## Decision

- OpenAI Responses API（`POST /v1/responses`）を `fetch` で直接呼ぶ。SDK は追加しない。
- 画像は `input_image` の data URL（`detail: "high"`）で渡し、`text.format` の strict JSON Schema で出力形式を固定する。スキーマとプロンプトは Workers AI と共通で、strict 用に全オブジェクトへ `additionalProperties: false` を付ける。
- 応答の解釈（`parseModelOutput`）も共通にし、範囲外の値は判読不能として人の確認に回す。
- `OPENAI_API_KEY` があれば Workers AI より優先する。モデルは `OPENAI_MODEL` で切り替え、未指定時は暫定で `gpt-5.6-terra`。評価に基づく採用ではない。

## Consequences

- 1回ごとに従量課金が発生する。ChatGPT の月額プランとは別に OpenAI Platform での支払い設定が必要。
- 画像は OpenAI に送信される。
- 採用モデルは `pnpm eval` で実際のスコア表を使って決める。
