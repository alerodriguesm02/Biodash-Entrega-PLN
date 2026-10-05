/**
 * Helpers JWT para autenticação no BioDashBD
 * Compatível com os tokens gerados pelo backend Express (BioDash_mobile/backend)
 */
import jwt from 'jsonwebtoken';

function getJwtSecret(): string {
  const configured = process.env.JWT_SECRET?.trim();
  if (configured) return configured;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET é obrigatório em produção.');
  }
  return 'biodash-local-development-only';
}

export interface JwtPayload {
  id: string;
  email: string;
  iat?: number;
  exp?: number;
}

/** Gera um JWT com validade de 30 dias */
export function signToken(payload: { id: string; email: string }): string {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: '30d' });
}

/** Verifica e decodifica um JWT. Lança erro se inválido. */
export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, getJwtSecret()) as JwtPayload;
}

/** Extrai o payload do JWT do cookie 'biodash_token'. Retorna null se inválido. */
export function getTokenFromCookieHeader(cookieHeader: string | null): JwtPayload | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(/biodash_token=([^;]+)/);
  if (!match) return null;
  try {
    return verifyToken(match[1]);
  } catch {
    return null;
  }
}

/** Aceita o Bearer token do app mobile/web e mantém compatibilidade com cookie. */
export function getTokenFromRequest(request: Request): JwtPayload | null {
  const authorization = request.headers.get('authorization');
  if (authorization?.startsWith('Bearer ')) {
    const token = authorization.slice(7).trim();
    if (token) {
      try {
        return verifyToken(token);
      } catch {
        return null;
      }
    }
  }
  return getTokenFromCookieHeader(request.headers.get('cookie'));
}
