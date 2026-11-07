import PageHeader from '../components/PageHeader'
import { ErrorState, LoadingState } from '../components/Feedback'
import { api } from '../api/client'
import { useFetch } from '../hooks/useFetch'
import { formatCurrency } from '../utils/formatCurrency'

const LOW_STOCK = 6

function Inventory() {
  const { data, loading, error, reload } = useFetch(() => api.products(), [])
  const products = (data?.products ?? []).filter((item) => item.isActive)

  return (
    <>
      <PageHeader title="Persediaan" description="Pantau jumlah stok dan nilai modal barang." />

      {error && <ErrorState error={error} onRetry={reload} />}
      {loading && !data && <LoadingState />}

      {data && (
        <div className="overflow-x-auto rounded-xl border bg-white">
          <table className="w-full min-w-[550px] text-left text-sm">
            <thead className="bg-aspal-100">
              <tr>
                <th className="p-4">Produk</th>
                <th className="p-4">Stok</th>
                <th className="p-4">Modal per unit</th>
                <th className="p-4">Nilai persediaan</th>
                <th className="p-4">Status</th>
              </tr>
            </thead>
            <tbody>
              {products.map((item) => (
                <tr key={item.id} className="border-t">
                  <td className="p-4 font-medium">{item.name}</td>
                  <td className="p-4">{item.stock}</td>
                  <td className="p-4">{formatCurrency(item.cost)}</td>
                  <td className="p-4">{formatCurrency(item.stock * item.cost)}</td>
                  <td className="p-4">
                    <span className={item.stock <= LOW_STOCK ? 'text-amber-600' : 'text-emerald-600'}>
                      {item.stock <= LOW_STOCK ? 'Stok menipis' : 'Tersedia'}
                    </span>
                  </td>
                </tr>
              ))}
              {!products.length && (
                <tr><td colSpan="5" className="p-6 text-center text-aspal-600">Belum ada produk aktif.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}

export default Inventory
