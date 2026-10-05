export const runtime = "nodejs";

import { NextRequest } from "next/server";
import pool from "@/lib/postgres/client";
import { getTokenFromRequest } from "@/lib/auth/jwt";
import { errorResponse, successResponse, unauthorizedResponse } from "@/lib/api-response";

const priorities = new Set(["low", "medium", "high"]);

export async function GET(request: NextRequest) {
  const user = getTokenFromRequest(request);
  if (!user) return unauthorizedResponse("Sessão inválida ou expirada.");
  try {
    const { rows } = await pool.query(
      "SELECT * FROM maintenance_schedules WHERE user_id = $1 ORDER BY scheduled_date DESC, created_at DESC LIMIT 50",
      [user.id]
    );
    return successResponse(rows);
  } catch (error) {
    console.error("Maintenance schedules GET error:", error);
    return errorResponse("Erro ao buscar manutenções.", 500);
  }
}

export async function POST(request: NextRequest) {
  const user = getTokenFromRequest(request);
  if (!user) return unauthorizedResponse("Sessão inválida ou expirada.");
  try {
    const body = await request.json();
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    const priority = priorities.has(body?.priority) ? body.priority : "low";
    const scheduledDate = new Date(body?.scheduledDate);
    if (!name) return errorResponse("O nome da manutenção é obrigatório.", 400);
    if (Number.isNaN(scheduledDate.getTime())) return errorResponse("A data da manutenção é inválida.", 400);

    const { rows } = await pool.query(
      `INSERT INTO maintenance_schedules (user_id, name, priority, status, scheduled_date)
       VALUES ($1, $2, $3, 'pending', $4) RETURNING *`,
      [user.id, name, priority, scheduledDate]
    );
    return successResponse(rows[0], "Manutenção agendada com sucesso.", 201);
  } catch (error: any) {
    if (error instanceof SyntaxError) return errorResponse("Corpo da requisição inválido.", 400);
    console.error("Maintenance schedules POST error:", error);
    return errorResponse("Erro ao agendar manutenção.", 500);
  }
}
