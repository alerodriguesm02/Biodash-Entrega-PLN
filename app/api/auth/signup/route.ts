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
  validatePassword,
} from "@/lib/api-response";

const SALT_ROUNDS = 10;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password, full_name, company_name } = body;

    // Validação de campos obrigatórios
    const requiredValidation = validateRequiredFields(body, ["email", "password", "full_name"]);
    if (!requiredValidation.valid) {
      return validationErrorResponse(requiredValidation.errors);
    }

    if (!isValidEmail(email)) {
      return validationErrorResponse({ email: ["Invalid email format"] });
    }

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return validationErrorResponse({ password: passwordValidation.errors });
    }

    if (full_name.trim().length < 2) {
      return validationErrorResponse({
        full_name: ["Full name must be at least 2 characters long"],
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Verifica se o email já existe no RDS
    const existing = await pool.query(
      "SELECT id FROM users WHERE email = $1",
      [normalizedEmail]
    );
    if (existing.rows.length > 0) {
      return errorResponse("An account with this email already exists", 409);
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    // Insere o usuário
    const userResult = await pool.query(
      "INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email",
      [normalizedEmail, passwordHash]
    );
    const user = userResult.rows[0];

    // Cria o perfil associado
    await pool.query(
      `INSERT INTO user_profiles (user_id, name, company, email)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id) DO NOTHING`,
      [user.id, full_name.trim(), company_name?.trim() || null, normalizedEmail]
    );

    const token = signToken({ id: user.id, email: user.email });

    const response = successResponse(
      {
        token,
        user: { id: user.id, email: user.email },
        userId: user.id,
        email: user.email,
        redirectTo: "/dashboard",
      },
      "Account created successfully!"
    ) as NextResponse;

    response.cookies.set("biodash_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });

    return response;
  } catch (error: any) {
    console.error("SIGNUP ERROR:", error);
    if (error instanceof SyntaxError) return errorResponse("Invalid request body", 400);
    return errorResponse("An unexpected error occurred while creating account", 500);
  }
}
