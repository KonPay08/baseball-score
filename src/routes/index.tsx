import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { BattingStatsTable } from '~/components/BattingStatsTable'
import { ScoreSheetReview } from '~/components/ScoreSheetReview'
import { fetchPlayers, submitCorrections, uploadScoreSheet } from '~/lib/apiClient'
import type { JobView } from '~/server/jobs'

export const Route = createFileRoute('/')({
  component: Home,
})

function Home() {
  const [file, setFile] = useState<File | null>(null)
  const [idempotencyKey, setIdempotencyKey] = useState('')
  const [job, setJob] = useState<JobView | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rosterNames, setRosterNames] = useState<string[]>([])

  useEffect(() => {
    fetchPlayers()
      .then((players) => setRosterNames(players.map((p) => p.name)))
      .catch(() => setRosterNames([]))
  }, [job?.revision, job?.id])

  const run = async (action: () => Promise<JobView>) => {
    setBusy(true)
    setError(null)
    try {
      setJob(await action())
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-bold">スコア表 成績集計（Prototype）</h1>
        <p className="text-sm text-gray-600">
          1試合分のスコア表画像をアップロードすると、読み取り結果と選手別の打撃成績を表示します。
        </p>
      </header>

      <form
        className="flex flex-wrap items-center gap-3 rounded border p-4"
        onSubmit={(e) => {
          e.preventDefault()
          if (file) void run(() => uploadScoreSheet(file, idempotencyKey))
        }}
      >
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
          aria-label="スコア表画像"
          onChange={(e) => {
            setFile(e.target.files?.[0] ?? null)
            setIdempotencyKey(crypto.randomUUID())
          }}
        />
        <button
          type="submit"
          className="rounded bg-gray-900 px-4 py-2 text-sm text-white disabled:opacity-40"
          disabled={!file || busy}
        >
          {busy ? '処理中…' : '解析する'}
        </button>
      </form>

      {error && (
        <p role="alert" className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {job && (
        <div className="space-y-6">
          <section className="rounded border p-4 text-sm" data-testid="job-status">
            <div>
              状態：<strong>{STATUS_LABEL[job.status]}</strong>（ジョブ {job.id.slice(0, 8)} / 修正回数 {job.revision}）
            </div>
            <div className="text-gray-600">
              {job.image.fileName}（{Math.round(job.image.size / 1024)} KB）・抽出方式 {job.extractor}
            </div>
            {job.error && <div className="mt-2 text-red-700">{job.error.message}</div>}
            {job.record && (
              <div className="mt-1 text-gray-600">
                {job.record.teamName.value ?? '?'} vs {job.record.opponentName.value ?? '?'}（
                {job.record.gameDate.value ?? '日付不明'}）
              </div>
            )}
          </section>
          {job.status === 'succeeded' && (
            <>
              <ScoreSheetReview
                key={job.revision}
                job={job}
                rosterNames={rosterNames}
                submitting={busy}
                onSubmit={(corrections) =>
                  void run(() => submitCorrections(job.id, job.revision, corrections))
                }
              />
              <BattingStatsTable stats={job.battingStats} />
            </>
          )}
        </div>
      )}
    </main>
  )
}

const STATUS_LABEL: Record<JobView['status'], string> = {
  processing: '解析中',
  succeeded: '解析完了',
  failed: '解析失敗',
}
