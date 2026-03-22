// ─── _shared/auth.ts ──────────────────────────────────────────────────────────
// JWT payload extraction for edge functions deployed with --no-verify-jwt.
// Supabase verifies the JWT signature at the edge before calling the function;
// we only need to decode the payload here to extract the user ID.
// ─────────────────────────────────────────────────────────────────────────────

type AuthResult =
  | { ok: true; userId: string; authHeader: string }
  | { ok: false; status: number; error: string }

export function extractUserId(req: Request): AuthResult {
  const authHeader = req.headers.get('Authorization') ?? ''
  const userJwt = authHeader.replace('Bearer ', '')

  if (!userJwt) {
    return { ok: false, status: 401, error: 'Missing Authorization header' }
  }

  const jwtParts = userJwt.split('.')
  if (jwtParts.length !== 3) {
    return { ok: false, status: 401, error: 'Invalid JWT format' }
  }

  try {
    const payloadBase64 = jwtParts[1].replace(/-/g, '+').replace(/_/g, '/')
    const padding = '='.repeat((4 - payloadBase64.length % 4) % 4)
    const payloadJson = atob(payloadBase64 + padding)
    const jwtPayload = JSON.parse(payloadJson)
    const userId = jwtPayload.sub
    if (!userId) {
      return { ok: false, status: 401, error: 'JWT missing sub claim' }
    }
    return { ok: true, userId, authHeader }
  } catch {
    return { ok: false, status: 401, error: 'Invalid JWT payload' }
  }
}
