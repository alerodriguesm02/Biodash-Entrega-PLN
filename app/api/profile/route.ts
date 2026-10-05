export const runtime = "nodejs";

import { NextRequest } from "next/server";
import pool from "@/lib/postgres/client";
import { getTokenFromRequest } from "@/lib/auth/jwt";
import { errorResponse, successResponse, unauthorizedResponse } from "@/lib/api-response";

export async function GET(request: NextRequest) {
  const user = getTokenFromRequest(request);
  if (!user) return unauthorizedResponse("Sessão inválida ou expirada.");
  try {
    const { rows } = await pool.query("SELECT * FROM user_profiles WHERE user_id = $1", [user.id]);
    return successResponse(rows[0] || { user_id: user.id, email: user.email });
  } catch (error) {
    console.error("Profile GET error:", error);
    return errorResponse("Não foi possível carregar o perfil.", 500);
  }
}

export async function PUT(request: NextRequest) {
  const user = getTokenFromRequest(request);
  if (!user) return unauthorizedResponse("Sessão inválida ou expirada.");
  try {
    const body = await request.json();
    const numero = body?.numero === null || body?.numero === "" ? null : Number(body?.numero);
    if (numero !== null && !Number.isInteger(numero)) return errorResponse("Número do endereço inválido.", 400);
    const values = [
      body?.name ?? null,
      body?.company ?? null,
      body?.razaoSocial ?? null,
      body?.cnpj ?? null,
      body?.address ?? null,
      numero,
      body?.city ?? null,
      body?.state ?? null,
      body?.zipCode ?? null,
      body?.phone ?? null,
      body?.email ?? user.email,
      body?.avatarUrl ?? null,
    ];
    const { rows } = await pool.query(
      `INSERT INTO user_profiles
       (user_id, name, company, razao_social, cnpj, address, numero, city, state, zip_code, phone, email, avatar_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       ON CONFLICT (user_id) DO UPDATE SET
         name = EXCLUDED.name, company = EXCLUDED.company, razao_social = EXCLUDED.razao_social,
         cnpj = EXCLUDED.cnpj, address = EXCLUDED.address, numero = EXCLUDED.numero,
         city = EXCLUDED.city, state = EXCLUDED.state, zip_code = EXCLUDED.zip_code,
         phone = EXCLUDED.phone, email = EXCLUDED.email,
         avatar_url = COALESCE(EXCLUDED.avatar_url, user_profiles.avatar_url), updated_at = NOW()
       RETURNING *`,
      [user.id, ...values]
    );
    return successResponse(rows[0], "Perfil atualizado com sucesso.");
  } catch (error: any) {
    if (error instanceof SyntaxError) return errorResponse("Corpo da requisição inválido.", 400);
    console.error("Profile PUT error:", error);
    return errorResponse("Não foi possível atualizar o perfil.", 500);
  }
}
