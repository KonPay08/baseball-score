# 0003. Select the extractor from Worker environment variables

## Status

Accepted

## Context

デプロイ済みの Worker で実際の画像を Workers AI に読ませたい。一方で、モデルは実画像での評価前で未選定であり、認証情報のないローカル開発・テストでは今までどおりサンプルで動かしたい。

## Decision

- 抽出器はリクエストごとに `cloudflare:workers` の `env` から選ぶ。`CLOUDFLARE_ACCOUNT_ID` と `CLOUDFLARE_API_TOKEN` が両方あれば Workers AI（REST API）、無ければ `sampleExtractor`。
- モデルは `WORKERS_AI_MODEL` で切り替える。未指定時は暫定で `@cf/meta/llama-4-scout-17b-16e-instruct` を使う。これは評価結果に基づく採用ではない。
- AI binding は追加しない。評価スクリプトと同じ REST 経路・同じ認証情報を使い、binding がローカル開発に Cloudflare ログインを要求しないようにする。

## Consequences

- Worker に API トークンを Secret として置く必要がある。モデル採用後に AI binding へ移行すればトークンは不要になる。
- 画像の base64 化は Worker の CPU 時間を使う。Workers Free の CPU 上限（10ms）で大きな画像が処理できるかは未検証。
- Job はメモリ上にあるため、デプロイ環境で別のインスタンスに振り分けられると Job が見つからない場合がある（0001 の制約のまま）。
