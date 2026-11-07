export function audit(tx, userId, action, entity, entityId, meta) {
  return tx.auditLog.create({
    data: { userId, action, entity, entityId: entityId == null ? null : String(entityId), meta: meta ?? undefined },
  })
}
