/**
 * lib/utils.ts — utilitários gerais (substituição do helper Supabase original)
 * O middleware de autenticação agora usa JWT (lib/auth/jwt.ts).
 * Este arquivo não é mais usado ativamente, mas mantido para compatibilidade.
 */
import { type NextRequest, NextResponse } from "next/server";

// Helper simples — passthrough sem Supabase
export const createClient = (request: NextRequest) => {
  return NextResponse.next({ request: { headers: request.headers } });
};
