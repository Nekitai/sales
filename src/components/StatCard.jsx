import { formatCurrency } from '../utils/formatCurrency'

// tone="profit" menandai angka laba (hasil akhir yang dicari pemilik) dengan garis kuning di atas kartu.
function StatCard({ title, value, money = false, tone = 'default' }) {
  const accent = tone === 'profit' ? 'border-t-4 border-t-lemon-400' : 'border-t-4 border-t-aspal-200'
  return (
    <div className={`rounded-lg border border-aspal-200 bg-white p-5 ${accent}`}>
      <p className="text-sm text-aspal-600">{title}</p>
      <p className="mt-2 break-words font-display text-3xl font-bold italic leading-none text-aspal-950">
        {money ? formatCurrency(value) : value}
      </p>
    </div>
  )
}

export default StatCard
