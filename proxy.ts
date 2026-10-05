import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyToken } from "@/lib/auth/jwt";

// Remove barra final se existir na origem
function normalizeOrigin(origin: string) {
  return origin.endsWith("/") ? origin.slice(0, -1) : origin;
}

// Origens adicionais para desenvolvimento e clientes externos.
const ALLOWED_ORIGINS = [
  process.env.FRONTEND_URL,
  "http://localhost:8081",
  "http://127.0.0.1:8081",
  "http://localhost:3003",
].filter(Boolean).map(url => normalizeOrigin(url as string));

function isAllowedOrigin(origin: string | null, requestOrigin: string): boolean {
  if (!origin) return false;
  const normalized = normalizeOrigin(origin);
  return normalized === normalizeOrigin(requestOrigin) || ALLOWED_ORIGINS.includes(normalized);
}

export async function proxy(req: NextRequest) {
  const origin = req.headers.get("origin");

  // CORS Preflight para /api
  if (req.method === "OPTIONS" && req.nextUrl.pathname.startsWith("/api")) {
    const resPre = new NextResponse(null, { status: 204 });
    if (origin && isAllowedOrigin(origin, req.nextUrl.origin)) {
      resPre.headers.set("Access-Control-Allow-Origin", normalizeOrigin(origin));
      resPre.headers.set("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
      resPre.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization, Cookie");
      resPre.headers.set("Access-Control-Allow-Credentials", "true");
      resPre.headers.set("Vary", "Origin");
    }
    return resPre;
  }

  const res = NextResponse.next();

  // CORS em rotas /api
  if (req.nextUrl.pathname.startsWith("/api")) {
    if (origin && isAllowedOrigin(origin, req.nextUrl.origin)) {
      res.headers.set("Access-Control-Allow-Origin", normalizeOrigin(origin));
      res.headers.set("Access-Control-Allow-Credentials", "true");
      res.headers.set("Vary", "Origin");
    }
  }

  // Proteção /dashboard — verifica JWT no cookie
  if (req.nextUrl.pathname.startsWith("/dashboard")) {
    const cookieHeader = req.headers.get("cookie") || "";
    const match = cookieHeader.match(/biodash_token=([^;]+)/);
    const token = match ? match[1] : null;

    let authenticated = false;
    if (token) {
      try {
        verifyToken(token);
        authenticated = true;
      } catch {
        authenticated = false;
      }
    }

    if (!authenticated) {
      const loginUrl = new URL("/login", req.url);
      loginUrl.searchParams.set("next", req.nextUrl.pathname + (req.nextUrl.search || ""));
      return NextResponse.redirect(loginUrl);
    }
  }

  return res;
}

export const config = {
  matcher: ["/dashboard/:path*", "/api/:path*"],
};
