import bcrypt from 'bcrypt'
import { config } from '../config.js'

const ROUNDS = config.isTest ? 4 : 12

export const hashPassword = (plain) => bcrypt.hash(plain, ROUNDS)
export const verifyPassword = (plain, hash) => bcrypt.compare(plain, hash)

// Hash dummy agar waktu respons login tidak membocorkan keberadaan username.
export const DUMMY_HASH = bcrypt.hashSync('dummy-password-for-timing', ROUNDS)
