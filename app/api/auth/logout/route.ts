import { NextResponse } from "next/server";
import { successResponse } from "@/lib/api-response";

export async function POST() {
  const response = successResponse(null, "Signed out successfully") as NextResponse;

  // Remove o cookie JWT
  response.cookies.set("biodash_token", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0, // expira imediatamente
  });

  return response;
}
