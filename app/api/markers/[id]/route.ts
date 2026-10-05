export const runtime = "nodejs";

import { NextRequest } from "next/server";
import pool from "@/lib/postgres/client";
import { getTokenFromRequest } from "@/lib/auth/jwt";
import { errorResponse, successResponse, unauthorizedResponse } from "@/lib/api-response";

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const user = getTokenFromRequest(request);
  if (!user) return unauthorizedResponse("Sessão inválida ou expirada.");
  try {
    const { id } = await context.params;
    const result = await pool.query(
      "DELETE FROM biodigestor_maps WHERE id = $1 AND user_id = $2",
      [id, user.id]
    );
    if (!result.rowCount) return errorResponse("Biodigestor não encontrado.", 404);
    return successResponse(undefined, "Biodigestor removido com sucesso.");
  } catch (error) {
    console.error("Markers DELETE error:", error);
    return errorResponse("Erro ao remover biodigestor.", 500);
  }
}
