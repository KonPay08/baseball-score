# Evaluation samples

実物のスコア表をここに置く。個人情報（選手名など）を含むため、このディレクトリの中身は Git に含めない（`.gitignore`）。

```
eval/samples/
  2026-09-20-vs-eagles/
    image.jpg        # jpg / jpeg / png / webp
    expected.json    # 人が原本から作った正解データ
```

`expected.json` の形式は `eval/example/demo/expected.json` を参照（型は `src/features/scoresheet/evaluation.ts` の `GroundTruth`）。原本で空欄の項目は `null` にする。

実行方法は `docs/evaluation.md`。
