import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import session from 'express-session'
import connectPgSimple from 'connect-pg-simple'
import { config, sessionCookieOptions } from './config.js'
import { pool } from './db.js'
import { cors, csrfProtect, originCheck, securityHeaders } from './middleware/security.js'
import { loadUser } from './middleware/auth.js'
import { errorHandler, notFoundHandler } from './middleware/error.js'
import { authRouter } from './routes/auth.js'
import { apiRouter } from './routes/index.js'

const DIST = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../dist')

// Sajikan frontend hasil build + fallback SPA (refresh di /owner/dashboard tidak 404).
// Dipasang sebelum session agar berkas statis tidak menyentuh database.
function mountClient(app) {
  if (!config.serveClient) return
  if (!fs.existsSync(path.join(DIST, 'index.html'))) {
    console.warn(`PERINGATAN: ${DIST} belum ada. Jalankan "npm run build" di folder root sebelum start.`)
    return
  }
  app.use(
    express.static(DIST, {
      index: false,
      setHeaders: (res, file) => {
        const hashed = file.includes(`${path.sep}assets${path.sep}`)
        res.setHeader('Cache-Control', hashed ? 'public, max-age=31536000, immutable' : 'no-cache')
      },
    }),
  )
  app.get(/^\/(?!api(?:\/|$)).*/, (req, res) => {
    res.setHeader('Cache-Control', 'no-cache')
    res.sendFile(path.join(DIST, 'index.html'))
  })
}

export function createApp({ loginLimitMax } = {}) {
  const app = express()
  app.disable('x-powered-by')
  if (config.trustProxy) app.set('trust proxy', 1)

  app.use(securityHeaders)
  mountClient(app)
  app.use(cors)
  app.use(express.json({ limit: '100kb' }))
  app.use(originCheck)

  const PgStore = connectPgSimple(session)
  app.use(
    session({
      name: 'dp.sid',
      store: new PgStore({ pool, tableName: 'session', createTableIfMissing: false }),
      secret: config.sessionSecret,
      resave: false,
      saveUninitialized: false,
      rolling: true,
      cookie: { ...sessionCookieOptions, maxAge: config.sessionMaxAgeMs },
    }),
  )

  app.get('/api/health', (req, res) => res.json({ ok: true }))
  app.use('/api', loadUser, csrfProtect)
  app.use('/api/auth', authRouter({ loginLimitMax }))
  app.use('/api', apiRouter)

  app.use(notFoundHandler)
  app.use(errorHandler)
  return app
}
