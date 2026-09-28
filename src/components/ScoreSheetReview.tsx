import { useState } from 'react'
import {
  PLATE_APPEARANCE_RESULTS,
  RESULT_LABELS,
  isResolved,
  type Cell,
  type CellField,
  type PlateAppearance,
} from '~/features/scoresheet/model'
import type { JobView } from '~/server/jobs'

type Draft = Record<string, unknown>
const draftKey = (paId: string, field: CellField) => `${paId}:${field}`

interface Props {
  job: JobView
  submitting: boolean
  onSubmit: (corrections: { plateAppearanceId: string; field: CellField; value: unknown }[]) => void
}

export function ScoreSheetReview({ job, submitting, onSubmit }: Props) {
  const [draft, setDraft] = useState<Draft>({})
  const record = job.record
  if (!record) return null

  const set = (paId: string, field: CellField, value: unknown) =>
    setDraft((d) => ({ ...d, [draftKey(paId, field)]: value }))

  const pending = Object.entries(draft).map(([key, value]) => {
    const [plateAppearanceId, field] = key.split(':') as [string, CellField]
    return { plateAppearanceId, field, value }
  })

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">
          抽出結果（要確認 <span data-testid="review-count">{job.reviewItems.length}</span> 件）
        </h2>
        <button
          type="button"
          className="rounded bg-blue-600 px-4 py-2 text-sm text-white disabled:opacity-40"
          disabled={pending.length === 0 || submitting}
          onClick={() => {
            onSubmit(pending)
            setDraft({})
          }}
        >
          修正を反映（{pending.length}）
        </button>
      </div>
      <p className="text-sm text-gray-600">
        黄色＝読み取りに自信がない、赤＝判読不能。原本と照合し、正しい値を選んで「修正を反映」を押してください。確定済みの値も変更できます。
      </p>
      <div className="overflow-x-auto">
        <table className="min-w-full border text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="border px-2 py-1">打順</th>
              <th className="border px-2 py-1">選手</th>
              <th className="border px-2 py-1">打席（回 / 結果 / 打点 / 得点）</th>
            </tr>
          </thead>
          <tbody>
            {record.batters.map((b) => (
              <tr key={b.id}>
                <td className="border px-2 py-1 text-center">{b.battingOrder}</td>
                <td className="border px-2 py-1 whitespace-nowrap">{b.name.value ?? '（判読不能）'}</td>
                <td className="border px-2 py-1">
                  <div className="flex flex-wrap gap-2">
                    {b.plateAppearances.map((pa) => (
                      <PlateAppearanceEditor key={pa.id} pa={pa} draft={draft} onChange={set} />
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function cellClass(cell: Cell<unknown>, edited: boolean) {
  if (edited) return 'border-blue-500 bg-blue-50'
  if (isResolved(cell)) return cell.source === 'corrected' ? 'border-green-500 bg-green-50' : 'border-gray-300'
  return cell.confidence === 'unreadable' ? 'border-red-500 bg-red-50' : 'border-yellow-500 bg-yellow-50'
}

function PlateAppearanceEditor({
  pa,
  draft,
  onChange,
}: {
  pa: PlateAppearance
  draft: Draft
  onChange: (paId: string, field: CellField, value: unknown) => void
}) {
  const value = <T,>(field: CellField, cell: Cell<T>) =>
    draftKey(pa.id, field) in draft ? draft[draftKey(pa.id, field)] : cell.value
  const edited = (field: CellField) => draftKey(pa.id, field) in draft
  const result = value('result', pa.result)
  const rbi = value('rbi', pa.rbi)
  const run = value('run', pa.run)

  return (
    <div className="flex items-center gap-1 rounded border border-gray-200 p-1" data-testid={`pa-${pa.id}`}>
      <span className="text-xs text-gray-500">{pa.inning}回</span>
      <select
        aria-label={`${pa.id} 結果`}
        className={`rounded border px-1 ${cellClass(pa.result, edited('result'))}`}
        value={typeof result === 'string' ? result : ''}
        onChange={(e) => onChange(pa.id, 'result', e.target.value)}
      >
        <option value="" disabled>
          ？
        </option>
        {PLATE_APPEARANCE_RESULTS.map((r) => (
          <option key={r} value={r}>
            {RESULT_LABELS[r]}
          </option>
        ))}
      </select>
      <select
        aria-label={`${pa.id} 打点`}
        className={`rounded border px-1 ${cellClass(pa.rbi, edited('rbi'))}`}
        value={typeof rbi === 'number' ? String(rbi) : ''}
        onChange={(e) => onChange(pa.id, 'rbi', Number(e.target.value))}
      >
        <option value="" disabled>
          ？
        </option>
        {[0, 1, 2, 3, 4].map((n) => (
          <option key={n} value={n}>
            {n}点
          </option>
        ))}
      </select>
      <select
        aria-label={`${pa.id} 得点`}
        className={`rounded border px-1 ${cellClass(pa.run, edited('run'))}`}
        value={typeof run === 'boolean' ? String(run) : ''}
        onChange={(e) => onChange(pa.id, 'run', e.target.value === 'true')}
      >
        <option value="" disabled>
          ？
        </option>
        <option value="true">生還</option>
        <option value="false">-</option>
      </select>
    </div>
  )
}
