export const runtime = "nodejs";

import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { NextRequest } from "next/server";
import { getTokenFromRequest } from "@/lib/auth/jwt";
import { errorResponse, successResponse, unauthorizedResponse } from "@/lib/api-response";
import { getS3Client, getS3Config } from "@/lib/s3";

export async function GET(request: NextRequest) {
  const user = getTokenFromRequest(request);
  if (!user) return unauthorizedResponse("Sessão inválida ou expirada.");

  try {
    const key = request.nextUrl.searchParams.get("key")?.trim() || "";
    if (!key.startsWith(`avatars/${user.id}/`) || key.includes("..")) {
      return errorResponse("Arquivo inválido.", 400);
    }

    const { bucket } = getS3Config();
    const command = new GetObjectCommand({ Bucket: bucket, Key: key });
    const downloadUrl = await getSignedUrl(getS3Client(), command, { expiresIn: 60 * 60 });
    return successResponse({ downloadUrl }, "URL de download gerada.");
  } catch (error) {
    console.error("S3 download URL error:", error);
    return errorResponse("Não foi possível carregar o arquivo.", 500);
  }
}
