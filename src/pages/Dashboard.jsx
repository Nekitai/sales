import { useState } from 'react'
import PageHeader from '../components/PageHeader'
import StatCard from '../components/StatCard'
import PeriodFilter from '../components/PeriodFilter'
import { presetRange } from '../utils/period'
import { ErrorState, LoadingState } from '../components/Feedback'
import { api } from '../api/client'
import { useFetch } from '../hooks/useFetch'
import { formatCurrency } from '../utils/formatCurrency'

const dash = (value) => (value === null ? 'Tidak tersedia' : value)

function Dashboard() {
  const [period, setPeriod] = useState(() => presetRange('month'))
  const { data, loading, error, reload } = useFetch(() => api.dashboard(period), [period.from, period.to])

  return (
    <>
      <PageHeader title="Dashboard" description="Ringkasan penjualan dan keuntungan toko." />
      <PeriodFilter value={period} onChange={setPeriod} />

      {error && <ErrorState error={error} onRetry={reload} />}
      {loading && !data && <LoadingState />}

      {data && (
        <>
          {data.summary.warnings.map((w) => (
            <p key={w} className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{w}</p>
          ))}

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard title="Omzet Bersih" value={data.summary.netSales} money />
            <StatCard title="Total HPP" value={data.summary.hpp} money />
            <StatCard title="Laba Kotor" tone="profit" value={dash(data.summary.grossProfit)} money={data.summary.grossProfit !== null} />
            <StatCard title="Laba Operasional" tone="profit" value={dash(data.summary.operatingProfit)} money={data.summary.operatingProfit !== null} />
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard title="Penjualan (setelah diskon)" value={data.summary.salesTotal} money />
            <StatCard title="Retur" value={data.summary.returns} money />
            <StatCard title="Pengeluaran" value={data.summary.expenses} money />
            <StatCard title="Nilai Persediaan (modal)" value={data.inventoryValue} money />
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-2">
            <section className="rounded-xl border border-aspal-200 bg-white p-5">
              <h3 className="mb-4 font-semibold">Transaksi Terbaru</h3>
              {data.recentSales.length === 0 ? (
                <p className="text-sm text-aspal-600">Belum ada transaksi penjualan.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b text-aspal-600">
                        <th className="py-3">Produk</th>
                        <th className="py-3">Jumlah</th>
                        <th className="py-3">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.recentSales.map((sale) => (
                        <tr key={sale.id} className="border-b last:border-0">
                          <td className="py-3">{sale.items.map((i) => i.productName).join(', ')}</td>
                          <td className="py-3">{sale.items.reduce((s, i) => s + i.qty, 0)}</td>
                          <td className="py-3">{formatCurrency(sale.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="rounded-xl border border-aspal-200 bg-white p-5">
              <h3 className="mb-4 font-semibold">Stok Menipis</h3>
              {data.lowStock.length === 0 ? (
                <p className="text-sm text-aspal-600">Tidak ada produk dengan stok menipis.</p>
              ) : (
                data.lowStock.map((item) => (
                  <div key={item.id} className="flex justify-between gap-3 border-b py-3 last:border-0">
                    <span>{item.name}</span>
                    <span className="font-semibold text-amber-600">{item.stock} unit</span>
                  </div>
                ))
              )}
            </section>
          </div>
        </>
      )}
    </>
  )
}

export default Dashboard
