import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from './generated/prisma/client.ts'
import pg from 'pg'
import { config } from './config.js'

// Satu pool dipakai bersama oleh Prisma dan session store.
export const pool = new pg.Pool({ connectionString: config.databaseUrl, max: 10 })
export const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })
