import { presetRange } from '../utils/period'

function PeriodFilter({ value, onChange }) {
  const presets = [['today', 'Hari ini'], ['7d', '7 hari'], ['month', 'Bulan ini'], ['all', 'Semua']]
  return (
    <div className="mb-6 flex flex-wrap items-end gap-3 rounded-xl border border-aspal-200 bg-white p-4 text-sm">
      <label>
        Dari
        <input type="date" className="mt-1 block rounded-lg border p-2" value={value.from} max={value.to}
          onChange={(e) => e.target.value && onChange({ ...value, from: e.target.value })} />
      </label>
      <label>
        Sampai
        <input type="date" className="mt-1 block rounded-lg border p-2" value={value.to} min={value.from}
          onChange={(e) => e.target.value && onChange({ ...value, to: e.target.value })} />
      </label>
      <div className="flex flex-wrap gap-2">
        {presets.map(([key, label]) => (
          <button key={key} type="button" onClick={() => onChange(presetRange(key))}
            className="rounded-lg border border-aspal-300 px-3 py-2 hover:bg-aspal-100">{label}</button>
        ))}
      </div>
    </div>
  )
}

export default PeriodFilter
