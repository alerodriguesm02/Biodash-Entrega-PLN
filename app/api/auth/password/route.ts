export const runtime = "nodejs";

import bcrypt from "bcryptjs";
import { NextRequest } from "next/server";
import pool from "@/lib/postgres/client";
import { getTokenFromRequest } from "@/lib/auth/jwt";
import { errorResponse, successResponse, unauthorizedResponse, validatePassword } from "@/lib/api-response";

export async function PUT(request: NextRequest) {
  const user = getTokenFromRequest(request);
  if (!user) return unauthorizedResponse("Sessão inválida ou expirada.");
  try {
    const body = await request.json();
    const currentPassword = typeof body?.currentPassword === "string" ? body.currentPassword : "";
    const password = typeof body?.newPassword === "string" ? body.newPassword : "";
    if (!currentPassword) return errorResponse("Informe a senha atual.", 400);
    const validation = validatePassword(password);
    if (!validation.valid) return errorResponse(validation.errors[0], 400);
    const result = await pool.query("SELECT password_hash FROM users WHERE id = $1", [user.id]);
    if (!result.rowCount || !(await bcrypt.compare(currentPassword, result.rows[0].password_hash))) {
      return errorResponse("A senha atual está incorreta.", 401);
    }
    const hash = await bcrypt.hash(password, 10);
    await pool.query("UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2", [hash, user.id]);
    return successResponse(undefined, "Senha atualizada com sucesso.");
  } catch (error: any) {
    if (error instanceof SyntaxError) return errorResponse("Corpo da requisição inválido.", 400);
    console.error("Password update error:", error);
    return errorResponse("Não foi possível atualizar a senha.", 500);
  }
}
