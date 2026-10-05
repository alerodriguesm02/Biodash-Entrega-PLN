export const runtime = "nodejs";

import { NextRequest } from "next/server";
import pool from "@/lib/postgres/client";
import { getTokenFromRequest } from "@/lib/auth/jwt";
import { getUserIndicators } from "@/lib/chatbot-data";
import { errorResponse, successResponse, unauthorizedResponse } from "@/lib/api-response";

export async function GET(request: NextRequest) {
  const user = getTokenFromRequest(request);
  if (!user) return unauthorizedResponse("Sessão inválida ou expirada.");
  try {
    return successResponse(await getUserIndicators(user.id));
  } catch (error) {
    console.error("Indicators GET error:", error);
    return errorResponse("Erro ao buscar indicadores.", 500);
  }
}

export async function POST(request: NextRequest) {
  const user = getTokenFromRequest(request);
  if (!user) return unauthorizedResponse("Sessão inválida ou expirada.");
  try {
    const body = await request.json();
    const month = Number(body?.month);
    const year = Number(body?.year);
    const waste = Number(body?.wasteProcessed ?? 0);
    const energy = Number(body?.energyGenerated ?? 0);
    const savings = Number(body?.taxSavings ?? 0);
    if (!Number.isInteger(month) || month < 0 || month > 11 || !Number.isInteger(year) || year < 2000 || year > 2200) {
      return errorResponse("Mês ou ano inválido.", 400);
    }
    if (![waste, energy, savings].every(Number.isFinite)) {
      return errorResponse("Os valores dos indicadores devem ser numéricos.", 400);
    }

    const measuredAt = new Date(Date.UTC(year, month, 15));
    const start = new Date(Date.UTC(year, month, 1));
    const end = new Date(Date.UTC(year, month + 1, 1));
    const existing = await pool.query(
      `SELECT id FROM biodigester_indicators
       WHERE user_id = $1 AND measured_at >= $2 AND measured_at < $3
       ORDER BY measured_at DESC LIMIT 1`,
      [user.id, start, end]
    );

    const result = existing.rowCount
      ? await pool.query(
          `UPDATE biodigester_indicators
           SET waste_processed = $1, energy_generated = $2, tax_savings = $3, measured_at = $4
           WHERE id = $5 AND user_id = $6 RETURNING *`,
          [waste, energy, savings, measuredAt, existing.rows[0].id, user.id]
        )
      : await pool.query(
          `INSERT INTO biodigester_indicators
           (user_id, waste_processed, energy_generated, tax_savings, measured_at)
           VALUES ($1, $2, $3, $4, $5) RETURNING *`,
          [user.id, waste, energy, savings, measuredAt]
        );

    const row = result.rows[0];
    return successResponse({
      ...row,
      waste_processed: Number(row.waste_processed),
      energy_generated: Number(row.energy_generated),
      tax_savings: Number(row.tax_savings),
    }, "Indicador salvo com sucesso.", existing.rowCount ? 200 : 201);
  } catch (error: any) {
    if (error instanceof SyntaxError) return errorResponse("Corpo da requisição inválido.", 400);
    console.error("Indicators POST error:", error);
    return errorResponse("Erro ao salvar indicador.", 500);
  }
}
