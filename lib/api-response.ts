import { NextResponse } from "next/server";

/**
 * Padrão de resposta da API
 */
export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  error?: string;
  data?: T;
  errors?: Record<string, string[]>; // Para validações de campos
}

/**
 * Cria uma resposta de sucesso padronizada
 */
export function successResponse<T>(
  data?: T,
  message?: string,
  status: number = 200
): NextResponse<ApiResponse<T>> {
  return NextResponse.json(
    {
      success: true,
      ...(message && { message }),
      ...(data !== undefined && { data }),
    },
    { status }
  );
}

/**
 * Cria uma resposta de erro padronizada
 */
export function errorResponse(
  error: string,
  status: number = 400,
  errors?: Record<string, string[]>
): NextResponse<ApiResponse> {
  return NextResponse.json(
    {
      success: false,
      error,
      ...(errors && { errors }),
    },
    { status }
  );
}

/**
 * Cria uma resposta de erro de validação padronizada
 */
export function validationErrorResponse(
  errors: Record<string, string[]>
): NextResponse<ApiResponse> {
  return NextResponse.json(
    {
      success: false,
      error: "Validation failed",
      errors,
    },
    { status: 400 }
  );
}

/**
 * Cria uma resposta de não autorizado padronizada
 */
export function unauthorizedResponse(
  message: string = "Unauthorized"
): NextResponse<ApiResponse> {
  return NextResponse.json(
    {
      success: false,
      error: message,
    },
    { status: 401 }
  );
}

/**
 * Cria uma resposta de erro interno padronizada
 */
export function internalErrorResponse(
  message: string = "Internal server error"
): NextResponse<ApiResponse> {
  return NextResponse.json(
    {
      success: false,
      error: message,
    },
    { status: 500 }
  );
}

/**
 * Valida formato de email
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Valida força da senha
 */
export function validatePassword(password: string): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push("Password must be at least 8 characters long");
  }
  if (!/[A-Z]/.test(password)) {
    errors.push("Password must contain at least one uppercase letter");
  }
  if (!/[a-z]/.test(password)) {
    errors.push("Password must contain at least one lowercase letter");
  }
  if (!/[0-9]/.test(password)) {
    errors.push("Password must contain at least one number");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Valida campos obrigatórios
 */
export function validateRequiredFields(
  data: Record<string, any>,
  requiredFields: string[]
): {
  valid: boolean;
  errors: Record<string, string[]>;
} {
  const errors: Record<string, string[]> = {};

  requiredFields.forEach((field) => {
    if (!data[field] || (typeof data[field] === "string" && data[field].trim() === "")) {
      errors[field] = [`${field} is required`];
    }
  });

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

