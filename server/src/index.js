import { createApp } from './app.js'
import { config } from './config.js'
import { pool, prisma } from './db.js'

const server = createApp().listen(config.port, () => {
  console.log(`API berjalan di port ${config.port} (${config.env})`)
  console.log(`Origin frontend yang diizinkan: ${config.clientOrigins.join(', ')}`)
  if (config.isProd && !config.trustProxy) {
    console.warn('PERINGATAN: TRUST_PROXY=false. Bila ada reverse proxy HTTPS di depan Node, cookie login tidak akan terkirim.')
  }
})

async function shutdown() {
  server.close()
  await prisma.$disconnect()
  await pool.end()
  process.exit(0)
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
