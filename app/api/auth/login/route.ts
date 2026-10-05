import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import pool from "@/lib/postgres/client";
import { signToken } from "@/lib/auth/jwt";
import {
  successResponse,
  errorResponse,
  validationErrorResponse,
  isValidEmail,
  validateRequiredFields,
} from "@/lib/api-response";
const logger = require("@/lib/logger-winston");

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password } = body;

    logger.info("Login attempt", { email });

    const requiredValidation = validateRequiredFields(body, ["email", "password"]);
    if (!requiredValidation.valid) {
      logger.warn("Login validation failed", { email, errors: requiredValidation.errors });
      return validationErrorResponse(requiredValidation.errors);
    }

    if (!isValidEmail(email)) {
      return validationErrorResponse({ email: ["Invalid email format"] });
    }

    // Busca usuário no PostgreSQL RDS
    const result = await pool.query(
      "SELECT id, email, password_hash FROM users WHERE email = $1",
      [email.trim().toLowerCase()]
    );

    if (result.rows.length === 0) {
      logger.warn("Login failed - user not found", { email });
      return errorResponse("Invalid email or password", 401);
    }

    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      logger.warn("Login failed - wrong password", { email });
      return errorResponse("Invalid email or password", 401);
    }

    const token = signToken({ id: user.id, email: user.email });

    logger.info("Login successful", { userId: user.id, email: user.email });

    const response = successResponse(
      {
        token,
        user: { id: user.id, email: user.email },
        userId: user.id,
        email: user.email,
        redirectTo: "/dashboard",
      },
      "Login successful"
    );

    // Define o JWT em cookie httpOnly
    (response as NextResponse).cookies.set("biodash_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30, // 30 dias
    });

    return response;
  } catch (error: any) {
    logger.error("Login error", { error: error.message });
    console.error("Login error:", error);
    if (error instanceof SyntaxError) return errorResponse("Invalid request body", 400);
    return errorResponse("An unexpected error occurred", 500);
  }
}
