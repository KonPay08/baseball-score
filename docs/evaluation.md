# Extraction Evaluation

AI の読み取り精度を、人が作った正解データと突き合わせて比較する仕組み。比較対象は Workers AI の画像対応モデル（`WORKERS_AI_VISION_CANDIDATES`、`src/server/workersAi.ts`）と OpenAI のモデル（`OPENAI_VISION_CANDIDATES`、`src/server/openai.ts`）。

## 準備

1. `eval/samples/<試合ID>/` に `image.jpg` と `expected.json` を置く（`eval/samples/README.md`）。
2. `.env` に比較するプロバイダの認証情報を設定する。Workers AI は `CLOUDFLARE_ACCOUNT_ID` と `CLOUDFLARE_API_TOKEN`（Workers AI 権限のみのトークン）、OpenAI は `OPENAI_API_KEY`。
3. `@cf/meta/llama-3.2-11b-vision-instruct` は初回に Meta のライセンス同意が必要（モデルに `"prompt": "agree"` を送る。Cloudflare のモデルページ参照）。

## 実行

```bash
pnpm eval                                   # 全候補 × eval/samples
pnpm eval --models gpt-5.6-terra,gpt-5.6-luna
pnpm eval --models @cf/google/gemma-3-12b-it,@cf/qwen/qwen3.8-27b
pnpm eval --models sample --samples eval/example   # APIキーなしで仕組みだけ確認
```

モデル別の集計表を出力し、詳細（サンプルごとの内訳・モデルの生の応答）を `eval/results/<日時>.json` に保存する（Git 対象外）。

## 指標

項目（header = チーム名・相手・日付、name、result、rbi、run）ごとに、正解の各値を次のどれかに分類する。

| 分類 | 意味 |
| --- | --- |
| correct | 値が正しく、自信あり |
| correctFlagged | 値は正しいが要確認になった（確認の手間が増える） |
| flagged | 誤り・判読不能で要確認になった（確認で拾える） |
| silentError | 誤りなのに自信あり（確認で見逃される。最も害が大きい） |
| missing | 抽出結果に該当する欄がない |

- 正解率 = (correct + correctFlagged) / 正解の値の数
- 見逃し誤り = silentError / 正解の値の数
- 要確認数 = UI で確認を求めるセル数（`listReviewItems`）
- 費用 = モデルが返したトークン数 × モデルページの単価（Workers AI は 2026-09-28、OpenAI は 2026-09-29 時点の標準料金）。無料枠（Neurons）との換算は実測後に確認する。

照合方法：打者は打順、打席はイニング順に並べた位置で対応させる。選手名は空白の違いを無視する。

## 未確認事項

- 各モデルへの画像の渡し方（`inputStyle`）と JSON Schema 指定（`response_format`）が実際に効くかは、API キーを使った実測で確認する。
- 評価件数・合格ライン（PROJECT.md の Success Criteria）。
