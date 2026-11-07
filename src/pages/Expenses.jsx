import { useState } from 'react'
import PageHeader from '../components/PageHeader'
import { ErrorState, LoadingState, Notice } from '../components/Feedback'
import { api } from '../api/client'
import { useFetch } from '../hooks/useFetch'
import { formatCurrency } from '../utils/formatCurrency'

function Expenses() {
  const { data, loading, error, reload } = useFetch(() => api.expenses(), [])
  const expenses = data?.expenses ?? []
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  async function saveExpense(event) {
    event.preventDefault()
    setFormError('')

    const nominal = Number(amount)
    if (!name.trim()) return setFormError('Keterangan wajib diisi.')
    if (!Number.isInteger(nominal) || nominal <= 0) return setFormError('Nominal harus bilangan bulat lebih dari 0.')

    setSaving(true)
    try {
      await api.createExpense({ description: name.trim(), amount: nominal, category: 'Operasional' })
      setName('')
      setAmount('')
      await reload()
    } catch (err) {
      setFormError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <PageHeader title="Pengeluaran" description="Catat biaya operasional toko." />

      <Notice>{formError}</Notice>
      <form onSubmit={saveExpense} className="mb-6 grid gap-4 rounded-xl border bg-white p-5 sm:grid-cols-3">
        <input className="rounded-lg border p-2.5" placeholder="Contoh: Listrik toko" value={name} onChange={(e) => setName(e.target.value)} required />
        <input className="rounded-lg border p-2.5" type="number" min="1" placeholder="Nominal (Rp)" value={amount} onChange={(e) => setAmount(e.target.value)} required />
        <button disabled={saving} className="btn-primary">
          {saving ? 'Menyimpan...' : 'Simpan Pengeluaran'}
        </button>
      </form>

      {error && <ErrorState error={error} onRetry={reload} />}
      {loading && !data && <LoadingState />}

      {data && (
        <section className="overflow-x-auto rounded-xl border bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-aspal-100"><tr><th className="p-4">Tanggal</th><th className="p-4">Keterangan</th><th className="p-4">Nominal</th></tr></thead>
            <tbody>
              {expenses.map((item) => (
                <tr key={item.id} className="border-t">
                  <td className="p-4">{item.date}</td>
                  <td className="p-4">{item.description}</td>
                  <td className="p-4">{formatCurrency(item.amount)}</td>
                </tr>
              ))}
              {!expenses.length && <tr><td colSpan="3" className="p-6 text-center text-aspal-600">Belum ada pengeluaran.</td></tr>}
            </tbody>
          </table>
        </section>
      )}
    </>
  )
}

export default Expenses
