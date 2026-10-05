export const runtime = "nodejs";

import { NextRequest } from "next/server";
import pool from "@/lib/postgres/client";
import { getTokenFromRequest } from "@/lib/auth/jwt";
import { errorResponse, successResponse, unauthorizedResponse } from "@/lib/api-response";

export async function GET(request: NextRequest) {
  const user = getTokenFromRequest(request);
  if (!user) return unauthorizedResponse("Sessão inválida ou expirada.");
  try {
    const { rows } = await pool.query(
      `SELECT * FROM maintenance_incidents
       WHERE user_id = $1 AND last_notification_at >= NOW() - INTERVAL '48 hours'
         AND COALESCE(status, 'pending') <> 'resolved'
       ORDER BY created_at ASC LIMIT 1`,
      [user.id]
    );
    return successResponse(rows[0] || null);
  } catch (error) {
    console.error("Incidents GET error:", error);
    return errorResponse("Não foi possível carregar os incidentes.", 500);
  }
}
