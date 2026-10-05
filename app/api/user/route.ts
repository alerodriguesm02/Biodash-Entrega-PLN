import { NextRequest } from "next/server";
import pool from "@/lib/postgres/client";
import { getTokenFromRequest } from "@/lib/auth/jwt";
import { successResponse, errorResponse, unauthorizedResponse } from "@/lib/api-response";
const logger = require("@/lib/logger-winston");

// GET: retorna usuário autenticado via JWT
export async function GET(req: NextRequest) {
  try {
    const payload = getTokenFromRequest(req);

    if (!payload) {
      return unauthorizedResponse("Unauthorized");
    }

    const result = await pool.query(
      "SELECT id, email, created_at FROM users WHERE id = $1",
      [payload.id]
    );

    if (result.rows.length === 0) {
      return unauthorizedResponse("User not found");
    }

    const user = result.rows[0];

    logger.info("User data fetched", { userId: user.id, email: user.email });

    return successResponse({
      userId: user.id,
      email: user.email,
      createdAt: user.created_at,
    });
  } catch (e: any) {
    logger.error("GET /api/user error", { error: e.message });
    console.error("GET /api/user error:", e);
    return errorResponse("Failed to fetch user", 500);
  }
}

export async function POST() {
  return errorResponse("Use /api/auth/login para login", 405);
}
