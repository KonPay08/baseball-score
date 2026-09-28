# API

Base path: `/api`。レスポンスはすべてJSON。

## Error Format

```json
{ "error": { "code": "invalid_request", "message": "...", "details": {} } }
```

| HTTP | code | 発生条件 |
|---|---|---|
| 400 | `invalid_request` | multipartでない、`image` がない、空ファイル、JSONやスキーマが不正 |
| 404 | `not_found` | Job が存在しない |
| 409 | `job_not_ready` | 解析が成功していない Job への修正 |
| 409 | `revision_conflict` | `expectedRevision` が現在の revision と一致しない（`details.currentRevision`） |
| 413 | `payload_too_large` | 画像が10MBを超える（暫定の上限） |
| 415 | `unsupported_media_type` | jpeg / png / webp / heic / heif 以外 |
| 422 | `invalid_correction` | 修正値が不正（`details.index`）。修正は一部だけ反映されることはない |

## Job

```ts
{
  id: string
  status: 'processing' | 'succeeded' | 'failed'
  createdAt: string; updatedAt: string
  image: { fileName: string; contentType: string; size: number }
  extractor: string            // 'sample-fixture' | 'workers-ai:<model>'
  error: { code: 'extraction_failed' | 'internal_error'; message: string } | null
  record: GameRecord | null    // 修正を反映した記録
  revision: number             // 修正のたびに+1
  reviewItems: ReviewItem[]
  battingStats: BattingStats[]
}
```

`GameRecord`、`Cell`、`BattingStats` の型定義は `src/features/scoresheet/` を参照。

## POST /api/jobs

`multipart/form-data`。`image` フィールドに画像を入れる。

- Header `Idempotency-Key`（任意）：同じキーで再送すると、新しい Job を作らずに既存の Job を `200` で返す。
- `201 { job }`。解析に失敗した場合も Job は作成され、`status: 'failed'` を返す。
- サンプル抽出器は、ファイル名に `fail` を含む画像で解析失敗を再現する。

## GET /api/jobs/:jobId

`200 { job }`

## GET /api/jobs/:jobId/extraction

修正を反映していない生の抽出結果。`200 { jobId, extractor, extracted }`

## PATCH /api/jobs/:jobId/record

```json
{
  "expectedRevision": 0,
  "corrections": [
    { "plateAppearanceId": "b5-pa3", "field": "result", "value": "1B" },
    { "plateAppearanceId": "b4-pa3", "field": "rbi", "value": 1 },
    { "plateAppearanceId": "b7-pa2", "field": "run", "value": false }
  ]
}
```

- `field`: `result`（打席結果コード）/ `rbi`（0〜4の整数）/ `run`（boolean）
- `200 { job }`。成績は再計算され、`revision` が+1される。
