import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import expenses from './expenses.js'
import products from './products.js'
import reports from './reports.js'
import returns from './returns.js'
import sales from './sales.js'
import users from './users.js'

// Semua rute di bawah ini wajib login; izin per-role ditegakkan di tiap router.
export const apiRouter = Router()
apiRouter.use(requireAuth)
apiRouter.use('/products', products)
apiRouter.use('/sales', sales)
apiRouter.use('/expenses', expenses)
apiRouter.use('/returns', returns)
apiRouter.use('/reports', reports)
apiRouter.use('/users', users)
