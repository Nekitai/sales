import { useState } from 'react'
import PageHeader from '../components/PageHeader'
import { ErrorState, LoadingState, Notice } from '../components/Feedback'
import { api } from '../api/client'
import { useFetch } from '../hooks/useFetch'
import { formatCurrency } from '../utils/formatCurrency'

const dateTime = (iso) => new Date(iso).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })

function Returns() {
  const salesQuery = useFetch(() => api.sales(), [])
  const returnsQuery = useFetch(() => api.returns(), [])
  const [saleId, setSaleId] = useState('')
  const [sale, setSale] = useState(null)
  const [itemId, setItemId] = useState('')
  const [qty, setQty] = useState(1)
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function chooseSale(id) {
    setSaleId(id)
    setSale(null)
    setItemId('')
    setError('')
    if (!id) return
    try {
      setSale((await api.sale(id)).sale)
    } catch (err) {
      setError(err.message)
    }
  }

  const item = sale?.items.find((i) => i.id === Number(itemId))
  const remaining = item ? item.qty - item.returnedQty : 0

  async function saveReturn(event) {
    event.preventDefault()
    setError('')
    const amount = Number(qty)
    if (!item) return setError('Pilih barang yang diretur.')
    if (!Number.isInteger(amount) || amount < 1 || amount > remaining) return setError('Jumlah retur tidak valid.')

    setSaving(true)
    try {
      await api.createReturn({ saleId: sale.id, reason: reason.trim(), items: [{ saleItemId: item.id, qty: amount }] })
      setQty(1)
      setReason('')
      await chooseSale(String(sale.id))
      await returnsQuery.reload()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const returns = returnsQuery.data?.returns ?? []

  return (
    <>
      <PageHeader title="Retur" description="Catat barang yang dikembalikan pelanggan." />

      <Notice>{error}</Notice>
      {salesQuery.error && <ErrorState error={salesQuery.error} onRetry={salesQuery.reload} />}

      <form onSubmit={saveReturn} className="mb-6 grid gap-4 rounded-xl border bg-white p-5 sm:grid-cols-2">
        <select className="rounded-lg border p-2.5" value={saleId} onChange={(e) => chooseSale(e.target.value)} required>
          <option value="">Pilih transaksi</option>
          {salesQuery.data?.sales.map((s) => <option key={s.id} value={s.id}>{s.invoiceNo} — {formatCurrency(s.total)}</option>)}
        </select>

        <select className="rounded-lg border p-2.5" value={itemId} onChange={(e) => { setItemId(e.target.value); setQty(1) }} disabled={!sale} required>
          <option value="">Pilih barang</option>
          {sale?.items.filter((i) => i.qty - i.returnedQty > 0).map((i) => (
            <option key={i.id} value={i.id}>{i.productName} — sisa {i.qty - i.returnedQty} dari {i.qty}</option>
          ))}
        </select>

        <input className="rounded-lg border p-2.5" type="number" min="1" max={remaining || undefined} value={qty} onChange={(e) => setQty(e.target.value)} required />
        <input className="rounded-lg border p-2.5" placeholder="Alasan (opsional)" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} />

        <button disabled={saving} className="btn-primary sm:col-span-2">
          {saving ? 'Menyimpan...' : 'Simpan Retur'}
        </button>
      </form>

      {returnsQuery.error && <ErrorState error={returnsQuery.error} onRetry={returnsQuery.reload} />}
      {returnsQuery.loading && !returnsQuery.data && <LoadingState />}

      {returnsQuery.data && (
        <section className="overflow-x-auto rounded-xl border bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-aspal-100">
              <tr><th className="p-4">Tanggal</th><th className="p-4">Transaksi</th><th className="p-4">Produk</th><th className="p-4">Jumlah</th><th className="p-4">Nilai retur</th></tr>
            </thead>
            <tbody>
              {returns.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="p-4">{dateTime(r.createdAt)}</td>
                  <td className="p-4">{r.invoiceNo}</td>
                  <td className="p-4">{r.items.map((i) => i.productName).join(', ')}</td>
                  <td className="p-4">{r.items.reduce((s, i) => s + i.qty, 0)}</td>
                  <td className="p-4">{formatCurrency(r.refundAmount)}</td>
                </tr>
              ))}
              {!returns.length && <tr><td colSpan="5" className="p-6 text-center text-aspal-600">Belum ada retur.</td></tr>}
            </tbody>
          </table>
        </section>
      )}
    </>
  )
}

export default Returns
