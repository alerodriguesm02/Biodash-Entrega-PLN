export const runtime = 'nodejs';
import { NextRequest } from "next/server";
import pool from "@/lib/postgres/client";
import { getTokenFromRequest } from "@/lib/auth/jwt";
import { successResponse, unauthorizedResponse, errorResponse } from "@/lib/api-response";

export async function GET(request: NextRequest) {
  try {
    const payload = getTokenFromRequest(request);
    if (!payload) return unauthorizedResponse("Unauthorized");

    // Busca os últimos 30 registros do usuário em biodigester_indicators (schema RDS)
    const { rows } = await pool.query(
      `SELECT waste_processed, energy_generated, tax_savings, measured_at
       FROM biodigester_indicators
       WHERE user_id = $1
       ORDER BY measured_at DESC
       LIMIT 30`,
      [payload.id]
    );

    // Mapeia para o formato esperado pelo frontend
    const processedData = {
      wasteProcessed: rows
        .slice(0, 7)
        .reverse()
        .map((item) => ({
          month: new Date(item.measured_at).toLocaleDateString("pt-BR", { month: "short" }),
          value: Number(item.waste_processed) || 0,
        })),
      energyGenerated: rows
        .slice(0, 7)
        .reverse()
        .map((item) => ({
          month: new Date(item.measured_at).toLocaleDateString("pt-BR", { month: "short" }),
          value: Number(item.energy_generated) || 0,
        })),
      stats: {
        wasteProcessed: {
          value: rows[0]?.waste_processed?.toString() || "0",
          unit: "kg",
          change: "+12.5%",
          increasing: true,
        },
        energyGenerated: {
          value: rows[0]?.energy_generated?.toString() || "0",
          unit: "kWh",
          change: "+8.2%",
          increasing: true,
        },
        efficiency: {
          value: rows[0]?.tax_savings?.toString() || "0",
          unit: "R$",
          change: "+1.2%",
          increasing: true,
        },
      },
    };

    return successResponse(processedData, "Biodigester data retrieved successfully");
  } catch (error: any) {
    console.error("Biodigester data error:", error);
    return errorResponse("Internal server error", 500);
  }
}
