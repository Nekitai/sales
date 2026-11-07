
import { useState } from 'react'
import PageHeader from '../components/PageHeader'
import StatCard from '../components/StatCard'
import { ErrorState, LoadingState, Notice } from '../components/Feedback'
import { api } from '../api/client'
import { useFetch } from '../hooks/useFetch'
import { formatCurrency } from '../utils/formatCurrency'

const emptyForm = {
  name: '',
  category: '',
  cost: '',
  price: '',
  stock: '',
}

function Products() {
  const { data, loading, error, reload } = useFetch(() => api.products(), [])
  const products = data?.products ?? []
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState(null)
  const [query, setQuery] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  async function saveProduct(event) {
    event.preventDefault()
    setFormError('')

    const payload = {
      name: form.name.trim(),
      category: form.category.trim(),
      cost: Number(form.cost),
      price: Number(form.price),
      stock: Number(form.stock),
    }

    if (!payload.name) return setFormError('Nama produk wajib diisi.')
    if (![payload.cost, payload.price, payload.stock].every(Number.isInteger)) {
      return setFormError('Harga dan stok harus bilangan bulat.')
    }
    if (payload.cost < 1) return setFormError('Harga modal harus lebih dari 0.')
    if (payload.price < payload.cost) return setFormError('Harga jual tidak boleh lebih rendah dari harga modal.')
    if (payload.stock < 0) return setFormError('Stok tidak boleh negatif.')

    setSaving(true)
    try {
      if (editingId) await api.updateProduct(editingId, payload)
      else await api.createProduct(payload)
      setForm(emptyForm)
      setEditingId(null)
      setShowForm(false)
      await reload()
    } catch (err) {
      setFormError(err.message)
    } finally {
      setSaving(false)
    }
  }

  function editProduct(product) {
    setForm({
      name: product.name,
      category: product.category,
      cost: String(product.cost),
      price: String(product.price),
      stock: String(product.stock),
    })
    setEditingId(product.id)
    setShowForm(true)
  }

  async function deleteProduct(product) {
    if (!window.confirm(`Nonaktifkan ${product.name}? Riwayat transaksi tetap tersimpan.`)) return
    try {
      await api.deactivateProduct(product.id)
      await reload()
    } catch (err) {
      setFormError(err.message)
    }
  }

  async function activateProduct(product) {
    try {
      await api.updateProduct(product.id, { isActive: true })
      await reload()
    } catch (err) {
      setFormError(err.message)
    }
  }

  const filtered = products.filter((item) =>
    `${item.name} ${item.category}`.toLowerCase().includes(query.toLowerCase())
  )

  return (
    <>
      <PageHeader
        title="Produk"
        description="Kelola daftar produk, harga, dan stok toko."
        action={
          <button
            onClick={() => {
              setForm(emptyForm)
              setEditingId(null)
              setShowForm(!showForm)
            }}
            className="btn-primary text-sm"
          >
            + Tambah Produk
          </button>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard title="Jenis Produk" value={products.length} />
        <StatCard
          title="Total Stok"
          value={products.reduce((sum, item) => sum + item.stock, 0)}
        />
        <StatCard
          title="Stok Menipis"
          value={products.filter((item) => item.isActive && item.stock <= 6).length}
        />
      </div>

      {error && <ErrorState error={error} onRetry={reload} />}
      {loading && !data && <LoadingState />}
      {!showForm && <Notice>{formError}</Notice>}

      {showForm && (
        <form
          onSubmit={saveProduct}
          className="mb-6 grid gap-4 rounded-xl border border-aspal-200 bg-white p-5 sm:grid-cols-2"
        >
          <div className="sm:col-span-2"><Notice>{formError}</Notice></div>

          <label className="text-sm">
            Nama produk
            <input
              className="mt-1 w-full rounded-lg border p-2.5"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </label>

          <label className="text-sm">
            Kategori
            <input
              className="mt-1 w-full rounded-lg border p-2.5"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              required
            />
          </label>

          <label className="text-sm">
            Harga modal
            <input
              type="number"
              min="1"
              className="mt-1 w-full rounded-lg border p-2.5"
              value={form.cost}
              onChange={(e) => setForm({ ...form, cost: e.target.value })}
              required
            />
          </label>

          <label className="text-sm">
            Harga jual
            <input
              type="number"
              min="0"
              className="mt-1 w-full rounded-lg border p-2.5"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
              required
            />
          </label>

          <label className="text-sm">
            Stok
            <input
              type="number"
              min="0"
              className="mt-1 w-full rounded-lg border p-2.5"
              value={form.stock}
              onChange={(e) => setForm({ ...form, stock: e.target.value })}
              required
            />
          </label>

          <div className="flex items-end gap-2">
            <button disabled={saving} className="btn-primary">
              {saving ? 'Menyimpan...' : 'Simpan'}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-lg border px-4 py-2.5"
            >
              Batal
            </button>
          </div>
        </form>
      )}

      <section className="overflow-hidden rounded-xl border border-aspal-200 bg-white">
        <div className="p-5">
          <input
            placeholder="Cari nama produk atau kategori..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-lg border p-2.5 sm:max-w-sm"
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[650px] text-left text-sm">
            <thead className="bg-aspal-100 text-aspal-600">
              <tr>
                <th className="p-4">Nama</th>
                <th className="p-4">Kategori</th>
                <th className="p-4">Modal</th>
                <th className="p-4">Jual</th>
                <th className="p-4">Stok</th>
                <th className="p-4">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <tr key={item.id} className="border-t">
                  <td className="p-4 font-medium">
                    {item.name}
                    {!item.isActive && <span className="ml-2 rounded bg-aspal-100 px-2 py-0.5 text-xs text-aspal-600">Nonaktif</span>}
                  </td>
                  <td className="p-4">{item.category}</td>
                  <td className="p-4">{formatCurrency(item.cost)}</td>
                  <td className="p-4">{formatCurrency(item.price)}</td>
                  <td className="p-4">{item.stock}</td>
                  <td className="p-4">
                    <div className="flex gap-3">
                      <button onClick={() => editProduct(item)} className="text-action text-aspal-950">Edit</button>
                      {item.isActive ? (
                        <button onClick={() => deleteProduct(item)} className="text-action text-racing-700">Nonaktifkan</button>
                      ) : (
                        <button onClick={() => activateProduct(item)} className="text-action text-emerald-700">Aktifkan</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan="6" className="p-6 text-center text-aspal-600">
                    Produk tidak ditemukan.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  )
}

export default Products
