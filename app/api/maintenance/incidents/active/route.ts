export const runtime = "nodejs";

import { NextRequest } from "next/server";
import pool from "@/lib/postgres/client";
import { getTokenFromRequest } from "@/lib/auth/jwt";
import { errorResponse, successResponse, unauthorizedResponse } from "@/lib/api-response";

export async function PUT(request: NextRequest) {
  const user = getTokenFromRequest(request);
  if (!user) return unauthorizedResponse("Sessão inválida ou expirada.");
  try {
    const body = await request.json();
    const message = typeof body?.resolution_message === "string" ? body.resolution_message.trim() : "";
    if (!message) return errorResponse("A resolução é obrigatória.", 400);
    const { rows } = await pool.query(
      `UPDATE maintenance_incidents SET resolution_message = $1, status = 'resolved', updated_at = NOW()
       WHERE id = (SELECT id FROM maintenance_incidents
         WHERE user_id = $2 AND COALESCE(status, 'pending') <> 'resolved'
         ORDER BY created_at DESC LIMIT 1) RETURNING *`,
      [message, user.id]
    );
    return successResponse(rows[0] || null, "Incidente resolvido com sucesso.");
  } catch (error: any) {
    if (error instanceof SyntaxError) return errorResponse("Corpo da requisição inválido.", 400);
    console.error("Incidents PUT error:", error);
    return errorResponse("Não foi possível resolver o incidente.", 500);
  }
}
