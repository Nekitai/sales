import { badRequest } from './errors.js'

export function parse(schema, data) {
  const result = schema.safeParse(data)
  if (!result.success) {
    const details = result.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message }))
    throw badRequest(details[0]?.message || 'Input tidak valid.', details)
  }
  return result.data
}
