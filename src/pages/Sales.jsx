import { useState } from 'react'
import PageHeader from '../components/PageHeader'
import { ErrorState, LoadingState, Notice } from '../components/Feedback'
import { api } from '../api/client'
import { useFetch } from '../hooks/useFetch'
import { formatCurrency } from '../utils/formatCurrency'

const PAYMENTS = { CASH: 'Tunai', TRANSFER: 'Transfer', QRIS: 'QRIS' }
const dateTime = (iso) => new Date(iso).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })

function SalesHistory({ sales, owner }) {
  return (
    <section className="overflow-x-auto rounded-xl border bg-white">
      <table className="w-full min-w-[600px] text-left text-sm">
        <thead className="bg-aspal-100">
          <tr>
            <th className="p-4">Waktu</th>
            <th className="p-4">No. Transaksi</th>
            {owner && <th className="p-4">Kasir</th>}
            <th className="p-4">Produk</th>
            <th className="p-4">Jumlah</th>
            <th className="p-4">Total</th>
            {owner && <th className="p-4">HPP</th>}
          </tr>
        </thead>
        <tbody>
          {sales.map((sale) => (
            <tr key={sale.id} className="border-t">
              <td className="p-4">{dateTime(sale.createdAt)}</td>
              <td className="p-4">{sale.invoiceNo}</td>
              {owner && <td className="p-4">{sale.cashier?.name}</td>}
              <td className="p-4">{sale.items.map((i) => `${i.productName} ×${i.qty}`).join(', ')}</td>
              <td className="p-4">{sale.items.reduce((s, i) => s + i.qty, 0)}</td>
              <td className="p-4">{formatCurrency(sale.total)}</td>
              {owner && <td className="p-4">{formatCurrency(sale.items.reduce((s, i) => s + i.unitCost * i.qty, 0))}</td>}
            </tr>
          ))}
          {!sales.length && (
            <tr><td colSpan={owner ? 7 : 5} className="p-6 text-center text-aspal-600">Belum ada transaksi.</td></tr>
          )}
        </tbody>
      </table>
    </section>
  )
}

function Cashier({ products, onSaved }) {
  const [productId, setProductId] = useState('')
  const [qty, setQty] = useState(1)
  const [cart, setCart] = useState([])
  const [discount, setDiscount] = useState('')
  const [payment, setPayment] = useState('CASH')
  const [paid, setPaid] = useState('')
  const [error, setError] = useState('')
  const [receipt, setReceipt] = useState(null)
  const [saving, setSaving] = useState(false)

  const subtotal = cart.reduce((s, l) => s + l.price * l.qty, 0)
  const discountValue = Number(discount) || 0
  const total = subtotal - discountValue

  function addToCart(event) {
    event.preventDefault()
    setError('')
    const product = products.find((p) => p.id === Number(productId))
    const amount = Number(qty)
    if (!product) return setError('Pilih produk terlebih dahulu.')
    if (!Number.isInteger(amount) || amount < 1) return setError('Jumlah harus bilangan bulat minimal 1.')
    const inCart = cart.find((l) => l.productId === product.id)?.qty ?? 0
    if (inCart + amount > product.stock) return setError('Stok tidak mencukupi.')
    setCart((old) => {
      const exists = old.some((l) => l.productId === product.id)
      return exists
        ? old.map((l) => (l.productId === product.id ? { ...l, qty: l.qty + amount } : l))
        : [...old, { productId: product.id, name: product.name, price: product.price, qty: amount }]
    })
    setReceipt(null)
    setProductId('')
    setQty(1)
  }

  async function saveSale(event) {
    event.preventDefault()
    setError('')
    if (!cart.length) return setError('Keranjang masih kosong.')
    if (!Number.isInteger(discountValue) || discountValue < 0) return setError('Diskon harus bilangan bulat tidak negatif.')
    if (total < 0) return setError('Diskon melebihi subtotal.')
    const paidValue = payment === 'CASH' && paid !== '' ? Number(paid) : undefined
    if (paidValue !== undefined && paidValue < total) return setError('Uang yang dibayarkan kurang dari total.')

    setSaving(true)
    try {
      // Server menghitung ulang harga, total, dan HPP; yang dikirim hanya produk, jumlah, diskon, pembayaran.
      const { sale } = await api.createSale({
        items: cart.map((l) => ({ productId: l.productId, qty: l.qty })),
        discount: discountValue,
        paymentMethod: payment,
        amountPaid: paidValue,
      })
      setReceipt(sale)
      setCart([])
      setDiscount('')
      setPaid('')
      await onSaved()
    } catch (err) {
      setError(err.message)
      await onSaved() // segarkan stok bila ditolak karena stok berubah
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mb-6 space-y-4">
      <Notice>{error}</Notice>

      {receipt && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-900">
          <p className="font-semibold">Transaksi berhasil dicatat: {receipt.invoiceNo}</p>
          <ul className="mt-2 space-y-1">
            {receipt.items.map((i) => (
              <li key={i.id}>{i.productName} ×{i.qty} — {formatCurrency(i.lineTotal)}</li>
            ))}
          </ul>
          <p className="mt-2">
            Total {formatCurrency(receipt.total)} · Dibayar {formatCurrency(receipt.amountPaid)} · Kembalian {formatCurrency(receipt.change)}
          </p>
        </div>
      )}

      <form onSubmit={addToCart} className="grid gap-4 rounded-xl border bg-white p-5 sm:grid-cols-3">
        <label className="text-sm">
          Produk
          <select className="mt-1 w-full rounded-lg border p-2.5" value={productId} onChange={(e) => setProductId(e.target.value)}>
            <option value="">Pilih produk</option>
            {products.filter((p) => p.stock > 0).map((p) => (
              <option key={p.id} value={p.id}>{p.name} — {formatCurrency(p.price)} — stok {p.stock}</option>
            ))}
          </select>
        </label>

        <label className="text-sm">
          Jumlah
          <input type="number" min="1" value={qty} onChange={(e) => setQty(e.target.value)} className="mt-1 w-full rounded-lg border p-2.5" />
        </label>

        <button className="btn-primary self-end">Tambah ke Keranjang</button>
      </form>

      {cart.length > 0 && (
        <form onSubmit={saveSale} className="rounded-xl border bg-white p-5">
          <ul className="mb-4 divide-y text-sm">
            {cart.map((l) => (
              <li key={l.productId} className="flex items-center justify-between gap-3 py-2">
                <span>{l.name} ×{l.qty}</span>
                <span className="flex items-center gap-3">
                  {formatCurrency(l.price * l.qty)}
                  <button type="button" className="text-action text-racing-700" onClick={() => setCart((old) => old.filter((x) => x.productId !== l.productId))}>
                    Hapus
                  </button>
                </span>
              </li>
            ))}
          </ul>

          <div className="grid gap-4 sm:grid-cols-3">
            <label className="text-sm">
              Diskon (Rp)
              <input type="number" min="0" value={discount} onChange={(e) => setDiscount(e.target.value)} className="mt-1 w-full rounded-lg border p-2.5" placeholder="0" />
            </label>
            <label className="text-sm">
              Pembayaran
              <select className="mt-1 w-full rounded-lg border p-2.5" value={payment} onChange={(e) => setPayment(e.target.value)}>
                {Object.entries(PAYMENTS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
            {payment === 'CASH' && (
              <label className="text-sm">
                Uang diterima (Rp)
                <input type="number" min="0" value={paid} onChange={(e) => setPaid(e.target.value)} className="mt-1 w-full rounded-lg border p-2.5" placeholder={String(Math.max(total, 0))} />
              </label>
            )}
          </div>

          <p className="mt-4 text-sm text-aspal-700">
            Subtotal {formatCurrency(subtotal)} · Total <strong>{formatCurrency(Math.max(total, 0))}</strong>
            <span className="ml-2 text-xs text-aspal-500">(total final dihitung ulang oleh server)</span>
          </p>

          <button disabled={saving} className="btn-primary mt-4">
            {saving ? 'Menyimpan...' : 'Simpan Transaksi'}
          </button>
        </form>
      )}
    </div>
  )
}

function Sales({ mode }) {
  const owner = mode === 'owner'
  const history = useFetch(() => api.sales(), [])
  const productsQuery = useFetch(() => (owner ? Promise.resolve({ products: [] }) : api.products()), [owner])

  async function refresh() {
    await Promise.all([history.reload(), productsQuery.reload()])
  }

  return (
    <>
      <PageHeader
        title="Penjualan"
        description={owner ? 'Riwayat transaksi dari seluruh kasir.' : 'Catat transaksi penjualan toko.'}
      />

      {!owner && productsQuery.error && <ErrorState error={productsQuery.error} onRetry={productsQuery.reload} />}
      {!owner && productsQuery.data && <Cashier products={productsQuery.data.products} onSaved={refresh} />}

      {history.error && <ErrorState error={history.error} onRetry={history.reload} />}
      {history.loading && !history.data && <LoadingState />}
      {history.data && <SalesHistory sales={history.data.sales} owner={owner} />}
    </>
  )
}

export default Sales
