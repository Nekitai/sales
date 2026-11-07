import { useState } from 'react'
import PageHeader from '../components/PageHeader'
import StatCard from '../components/StatCard'
import PeriodFilter from '../components/PeriodFilter'
import { presetRange } from '../utils/period'
import { ErrorState, LoadingState } from '../components/Feedback'
import { api } from '../api/client'
import { useFetch } from '../hooks/useFetch'
import { formatCurrency } from '../utils/formatCurrency'

function Cashflow() {
  const [period, setPeriod] = useState(() => presetRange('month'))
  const { data, loading, error, reload } = useFetch(() => api.cashflow(period), [period.from, period.to])

  return (
    <>
      <PageHeader title="Arus Kas" description="Catatan uang masuk dan uang keluar." />
      <PeriodFilter value={period} onChange={setPeriod} />

      {error && <ErrorState error={error} onRetry={reload} />}
      {loading && !data && <LoadingState />}

      {data && (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard title="Kas Masuk" value={data.cashIn} money />
            <StatCard title="Kas Keluar" value={data.cashOut} money />
            <StatCard title="Saldo Bersih" tone="profit" value={data.netCash} money />
          </div>

          <p className="mt-3 text-xs text-aspal-600">
            Kas keluar mencakup pengeluaran dan pengembalian dana retur. Pembelian stok tidak dicatat di aplikasi ini.
          </p>

          <section className="mt-6 overflow-x-auto rounded-xl border bg-white">
            <table className="w-full min-w-[550px] text-left text-sm">
              <thead className="bg-aspal-100">
                <tr><th className="p-4">Tanggal</th><th className="p-4">Keterangan</th><th className="p-4">Jenis</th><th className="p-4">Nominal</th></tr>
              </thead>
              <tbody>
                {data.rows.map((item) => (
                  <tr key={item.id} className="border-t">
                    <td className="p-4">{item.date}</td>
                    <td className="p-4">{item.description}</td>
                    <td className="p-4">{item.type === 'MASUK' ? 'Masuk' : 'Keluar'}</td>
                    <td className="p-4">{formatCurrency(item.amount)}</td>
                  </tr>
                ))}
                {!data.rows.length && (
                  <tr><td colSpan="4" className="p-6 text-center text-aspal-600">Belum ada catatan arus kas.</td></tr>
                )}
              </tbody>
            </table>
          </section>
        </>
      )}
    </>
  )
}

export default Cashflow
