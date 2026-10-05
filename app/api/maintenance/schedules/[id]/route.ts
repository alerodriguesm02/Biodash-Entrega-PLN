export const runtime = "nodejs";

import { NextRequest } from "next/server";
import pool from "@/lib/postgres/client";
import { getTokenFromRequest } from "@/lib/auth/jwt";
import { errorResponse, successResponse, unauthorizedResponse } from "@/lib/api-response";

const statuses = new Set(["pending", "in_progress", "completed", "done", "archived", "cancelled"]);

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const user = getTokenFromRequest(request);
  if (!user) return unauthorizedResponse("Sessão inválida ou expirada.");
  try {
    const { id } = await context.params;
    const body = await request.json();
    if (!statuses.has(body?.status)) return errorResponse("Status de manutenção inválido.", 400);
    const { rows } = await pool.query(
      `UPDATE maintenance_schedules SET status = $1
       WHERE id = $2 AND user_id = $3 RETURNING *`,
      [body.status, id, user.id]
    );
    if (!rows.length) return errorResponse("Manutenção não encontrada.", 404);
    return successResponse(rows[0], "Manutenção atualizada com sucesso.");
  } catch (error: any) {
    if (error instanceof SyntaxError) return errorResponse("Corpo da requisição inválido.", 400);
    console.error("Maintenance schedules PUT error:", error);
    return errorResponse("Erro ao atualizar manutenção.", 500);
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const user = getTokenFromRequest(request);
  if (!user) return unauthorizedResponse("Sessão inválida ou expirada.");
  try {
    const { id } = await context.params;
    const result = await pool.query(
      "DELETE FROM maintenance_schedules WHERE id = $1 AND user_id = $2",
      [id, user.id]
    );
    if (!result.rowCount) return errorResponse("Manutenção não encontrada.", 404);
    return successResponse(undefined, "Manutenção removida com sucesso.");
  } catch (error) {
    console.error("Maintenance schedules DELETE error:", error);
    return errorResponse("Erro ao remover manutenção.", 500);
  }
}
