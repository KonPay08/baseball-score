/**
 * Runs extraction candidates against labelled score sheets and prints per-field accuracy, latency and cost.
 *
 *   pnpm eval                                  # all Workers AI and OpenAI candidates on eval/samples
 *   pnpm eval --models gpt-5.6-terra,gpt-5.6-luna
 *   pnpm eval --models sample --samples eval/example
 *   pnpm eval --models @cf/meta/llama-4-scout-17b-16e-instruct
 *
 * Each sample is a directory containing one image (image.jpg / .jpeg / .png / .webp) and expected.json.
 */
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { extname, join } from 'node:path'
import { parseArgs } from 'node:util'
import {
  EVALUATED_FIELDS,
  evaluateExtraction,
  parseGroundTruth,
  type EvaluationReport,
  type GroundTruth,
} from '~/features/scoresheet/evaluation'
import { sampleExtractor, type ScoreSheetImage } from '~/server/extractor'
import { OPENAI_VISION_CANDIDATES, runOpenAiExtraction } from '~/server/openai'
import {
  WORKERS_AI_VISION_CANDIDATES,
  createRestRunner,
  runWorkersAiExtraction,
  type ModelRunner,
  type TokenUsage,
} from '~/server/workersAi'

const IMAGE_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
}

interface Sample {
  id: string
  image: ScoreSheetImage
  truth: GroundTruth
}

interface RunResult {
  model: string
  sample: string
  ms: number
  usage: TokenUsage | null
  costUsd: number | null
  report: EvaluationReport | null
  error: string | null
  rawText: string | null
}

async function loadSamples(dir: string): Promise<Sample[]> {
  const entries = await readdir(dir, { withFileTypes: true })
  const samples: Sample[] = []
  for (const entry of entries.filter((e) => e.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
    const sampleDir = join(dir, entry.name)
    const files = await readdir(sampleDir)
    const imageFile = files.find((f) => f.startsWith('image') && IMAGE_TYPES[extname(f).toLowerCase()])
    if (!imageFile || !files.includes('expected.json')) {
      console.warn(`skip ${sampleDir}: needs image.(jpg|jpeg|png|webp) and expected.json`)
      continue
    }
    const bytes = await readFile(join(sampleDir, imageFile))
    samples.push({
      id: entry.name,
      image: {
        fileName: imageFile,
        contentType: IMAGE_TYPES[extname(imageFile).toLowerCase()],
        bytes: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
      },
      truth: parseGroundTruth(JSON.parse(await readFile(join(sampleDir, 'expected.json'), 'utf8'))),
    })
  }
  return samples
}

function cost(candidate: { pricing: { input: number; output: number } }, usage: TokenUsage): number | null {
  if (usage.promptTokens === null || usage.completionTokens === null) return null
  return (usage.promptTokens * candidate.pricing.input + usage.completionTokens * candidate.pricing.output) / 1e6
}

async function runOne(
  model: string,
  sample: Sample,
  runner: ModelRunner | null,
  openAiKey: string | null,
): Promise<RunResult> {
  const started = performance.now()
  const base = { model, sample: sample.id }
  try {
    if (model === 'sample') {
      const record = await sampleExtractor.extract(sample.image)
      const ms = performance.now() - started
      return { ...base, ms, usage: null, costUsd: 0, report: evaluateExtraction(sample.truth, record), error: null, rawText: null }
    }
    const openAiCandidate = OPENAI_VISION_CANDIDATES.find((c) => c.model === model)
    const workersAiCandidate = WORKERS_AI_VISION_CANDIDATES.find((c) => c.model === model)
    let extraction
    let candidate
    if (openAiCandidate) {
      if (!openAiKey) throw new Error('OPENAI_API_KEY is required')
      candidate = openAiCandidate
      extraction = await runOpenAiExtraction(openAiCandidate, { apiKey: openAiKey }, sample.image)
    } else if (workersAiCandidate) {
      if (!runner) throw new Error('CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN are required')
      candidate = workersAiCandidate
      extraction = await runWorkersAiExtraction(workersAiCandidate, runner, sample.image)
    } else {
      throw new Error(`unknown model: ${model}`)
    }
    const { record, rawText, usage } = extraction
    return {
      ...base,
      ms: performance.now() - started,
      usage,
      costUsd: cost(candidate, usage),
      report: evaluateExtraction(sample.truth, record),
      error: null,
      rawText,
    }
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e)
    return { ...base, ms: performance.now() - started, usage: null, costUsd: null, report: null, error, rawText: null }
  }
}

const pct = (n: number, d: number) => (d === 0 ? '-' : `${((n / d) * 100).toFixed(1)}%`)

function summarize(model: string, results: RunResult[]): string {
  const ok = results.filter((r) => r.report)
  const sum = (pick: (r: EvaluationReport) => number) => ok.reduce((acc, r) => acc + pick(r.report!), 0)
  const fieldCells = EVALUATED_FIELDS.map((f) =>
    pct(sum((r) => r.byField[f].correct + r.byField[f].correctFlagged), sum((r) => r.byField[f].expected)),
  )
  const expected = sum((r) => r.total.expected)
  const avgMs = ok.length ? Math.round(ok.reduce((a, r) => a + r.ms, 0) / ok.length) : null
  const costs = ok.map((r) => r.costUsd).filter((c): c is number => c !== null)
  const avgCost = costs.length ? `$${(costs.reduce((a, c) => a + c, 0) / costs.length).toFixed(5)}` : '-'
  return `| ${model} | ${ok.length}/${results.length} | ${fieldCells.join(' | ')} | ${pct(
    sum((r) => r.total.correct + r.total.correctFlagged),
    expected,
  )} | ${pct(sum((r) => r.total.silentError), expected)} | ${sum((r) => r.reviewItems)} | ${avgMs ?? '-'} | ${avgCost} |`
}

async function main() {
  const { values } = parseArgs({
    options: {
      models: { type: 'string' },
      samples: { type: 'string', default: 'eval/samples' },
      out: { type: 'string', default: 'eval/results' },
    },
  })
  const models = values.models
    ? values.models.split(',').map((m) => m.trim())
    : [...WORKERS_AI_VISION_CANDIDATES, ...OPENAI_VISION_CANDIDATES].map((c) => c.model)
  const samples = await loadSamples(values.samples)
  if (samples.length === 0) throw new Error(`no samples found in ${values.samples}`)

  const { CLOUDFLARE_ACCOUNT_ID: accountId, CLOUDFLARE_API_TOKEN: apiToken } = process.env
  const runner = accountId && apiToken ? createRestRunner({ accountId, apiToken }) : null
  const openAiKey = process.env.OPENAI_API_KEY || null

  const results: RunResult[] = []
  for (const model of models) {
    for (const sample of samples) {
      const result = await runOne(model, sample, runner, openAiKey)
      console.log(`${model} / ${sample.id}: ${result.error ?? `${Math.round(result.ms)}ms`}`)
      results.push(result)
    }
  }

  console.log()
  console.log(`| model | ok | ${EVALUATED_FIELDS.join(' | ')} | 正解率 | 見逃し誤り | 要確認数 | 平均ms | 平均費用 |`)
  console.log(`|${' --- |'.repeat(EVALUATED_FIELDS.length + 7)}`)
  for (const model of models) console.log(summarize(model, results.filter((r) => r.model === model)))

  await mkdir(values.out, { recursive: true })
  const file = join(values.out, `${new Date().toISOString().replace(/[:.]/g, '-')}.json`)
  await writeFile(file, JSON.stringify({ models, samples: samples.map((s) => s.id), results }, null, 2))
  console.log(`\ndetails: ${file}`)
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
