export function LoadingState({ text = 'Memuat data...' }) {
  return <p className="rounded-xl border border-aspal-200 bg-white p-6 text-sm text-aspal-600">{text}</p>
}

export function ErrorState({ error, onRetry }) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
      <p>{error?.message || 'Terjadi kesalahan.'}</p>
      {onRetry && (
        <button onClick={onRetry} className="mt-3 rounded-lg border border-red-300 px-3 py-1.5 font-medium hover:bg-red-100">
          Coba lagi
        </button>
      )}
    </div>
  )
}

export function Notice({ type = 'error', children }) {
  if (!children) return null
  const style = type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-700'
  return <p role="alert" className={`mb-4 rounded-lg border px-4 py-3 text-sm ${style}`}>{children}</p>
}
