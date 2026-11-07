import { pool } from '../db.js'

// Hapus semua session milik user (kecuali satu sid) -- dipakai saat nonaktif/reset password.
export async function destroyUserSessions(userId, exceptSid = null) {
  await pool.query(
    `DELETE FROM session WHERE (sess->>'userId')::int = $1 AND ($2::text IS NULL OR sid <> $2)`,
    [userId, exceptSid],
  )
}
