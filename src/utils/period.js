const ymd = (d) => d.toLocaleDateString('en-CA')

export const presetRange = (key) => {
  const now = new Date()
  const today = ymd(now)
  if (key === 'today') return { from: today, to: today }
  if (key === '7d') return { from: ymd(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6)), to: today }
  if (key === 'all') return { from: '2000-01-01', to: today }
  return { from: ymd(new Date(now.getFullYear(), now.getMonth(), 1)), to: today } // bulan ini
}
