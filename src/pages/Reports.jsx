import { useState } from 'react'
import PageHeader from '../components/PageHeader'
import StatCard from '../components/StatCard'
import PeriodFilter from '../components/PeriodFilter'
import { presetRange } from '../utils/period'
import { ErrorState, LoadingState, Notice } from '../components/Feedback'
import { api } from '../api/client'
import { useFetch } from '../hooks/useFetch'
import { formatCurrency } from '../utils/formatCurrency'

function Reports() {
  const [period, setPeriod] = useState(() => presetRange('month'))
  const [exportError, setExportError] = useState('')
  const { data, loading, error, reload } = useFetch(() => api.summary(period), [period.from, period.to])

  async function exportCsv() {
    setExportError('')
    try {
      const report = await api.salesReport(period)
      const rows = [
        ['No. Transaksi', 'Tanggal', 'Kasir', 'Produk', 'Jumlah', 'Harga', 'Diskon', 'Omzet', 'HPP'],
        ...report.sales.flatMap((sale) => sale.items.map((item) => [
          sale.invoiceNo, sale.createdAt.slice(0, 10), sale.cashier?.name ?? '', item.productName, item.qty,
          item.unitPrice, item.lineDiscount, item.lineTotal, item.unitCost * item.qty,
        ])),
      ]
      const csv = rows.map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\r\n')
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `laporan-penjualan-${period.from}-${period.to}.csv`
      link.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setExportError(err.message)
    }
  }

  return (
    <>
      <PageHeader
        title="Laporan"
        description="Ringkasan penjualan dan keuntungan toko."
        action={<button onClick={exportCsv} className="btn-primary">Unduh CSV</button>}
      />
      <PeriodFilter value={period} onChange={setPeriod} />
      <Notice>{exportError}</Notice>

      {error && <ErrorState error={error} onRetry={reload} />}
      {loading && !data && <LoadingState />}

      {data && (
        <>
          {data.warnings.map((w) => (
            <p key={w} className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{w}</p>
          ))}

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard title="Penjualan (setelah diskon)" value={data.salesTotal} money />
            <StatCard title="Retur" value={data.returns} money />
            <StatCard title="Omzet Bersih" value={data.netSales} money />
            <StatCard title="HPP (bersih retur)" value={data.hpp} money />
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <StatCard title="Laba Kotor" tone="profit" value={data.grossProfit ?? 'Tidak tersedia'} money={data.grossProfit !== null} />
            <StatCard title="Pengeluaran" value={data.expenses} money />
            <StatCard title="Laba Operasional" tone="profit" value={data.operatingProfit ?? 'Tidak tersedia'} money={data.operatingProfit !== null} />
          </div>

          <p className="mt-5 rounded-xl border bg-white p-5 text-sm text-aspal-700">
            {data.transactionCount} transaksi, diskon diberikan {formatCurrency(data.discounts)}. Laba kotor = omzet bersih − HPP;
            laba operasional = laba kotor − pengeluaran. Retur dicatat pada tanggal retur dilakukan.
          </p>
        </>
      )}
    </>
  )
}

export default Reports
