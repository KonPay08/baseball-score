import { formatAverage, type BattingStats } from '~/features/scoresheet/stats'

const COLUMNS: [keyof BattingStats, string][] = [
  ['plateAppearances', '打席'],
  ['atBats', '打数'],
  ['hits', '安打'],
  ['doubles', '二'],
  ['triples', '三'],
  ['homeRuns', '本'],
  ['runsBattedIn', '打点'],
  ['runs', '得点'],
  ['walks', '四球'],
  ['hitByPitch', '死球'],
  ['strikeouts', '三振'],
  ['sacrificeBunts', '犠打'],
  ['sacrificeFlies', '犠飛'],
]

export function BattingStatsTable({ stats }: { stats: BattingStats[] }) {
  return (
    <section className="space-y-2">
      <h2 className="text-lg font-semibold">打撃成績</h2>
      <p className="text-sm text-gray-600">
        「暫定」の選手は未確認の箇所があり、その打席・項目は集計に含めていません（0として扱いません）。
      </p>
      <div className="overflow-x-auto">
        <table className="min-w-full border text-sm" data-testid="batting-stats">
          <thead className="bg-gray-100">
            <tr>
              <th className="border px-2 py-1">打順</th>
              <th className="border px-2 py-1">選手</th>
              {COLUMNS.map(([, label]) => (
                <th key={label} className="border px-2 py-1">
                  {label}
                </th>
              ))}
              <th className="border px-2 py-1">打率</th>
              <th className="border px-2 py-1">状態</th>
            </tr>
          </thead>
          <tbody>
            {stats.map((s) => (
              <tr key={s.batterId} className={s.complete ? '' : 'bg-yellow-50'}>
                <td className="border px-2 py-1 text-center">{s.battingOrder}</td>
                <td className="border px-2 py-1 whitespace-nowrap">{s.name ?? '（判読不能）'}</td>
                {COLUMNS.map(([key]) => (
                  <td key={key} className="border px-2 py-1 text-right">
                    {s[key]}
                  </td>
                ))}
                <td className="border px-2 py-1 text-right">{formatAverage(s.battingAverage)}</td>
                <td className="border px-2 py-1 text-center whitespace-nowrap">
                  {s.complete ? '確定' : `暫定（未確認${s.unresolvedCells}）`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
