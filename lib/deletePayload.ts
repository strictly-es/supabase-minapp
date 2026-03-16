export function buildSoftDeletePayload(userId?: string | null, now = new Date()): Record<string, unknown> {
  const payload: Record<string, unknown> = { deleted_at: now.toISOString() }
  if (userId) payload.deleted_by = userId
  return payload
}
