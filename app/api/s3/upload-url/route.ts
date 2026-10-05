export const runtime = "nodejs";

import { randomUUID } from "node:crypto";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { NextRequest } from "next/server";
import { getTokenFromRequest } from "@/lib/auth/jwt";
import { errorResponse, successResponse, unauthorizedResponse } from "@/lib/api-response";
import { getS3Client, getS3Config } from "@/lib/s3";

const allowedTypes = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);

export async function POST(request: NextRequest) {
  const user = getTokenFromRequest(request);
  if (!user) return unauthorizedResponse("Sessão inválida ou expirada.");

  try {
    const body = await request.json();
    const contentType = typeof body?.contentType === "string" ? body.contentType.toLowerCase() : "";
    const extension = allowedTypes.get(contentType);
    if (!extension) return errorResponse("Formato inválido. Use JPEG, PNG ou WebP.", 400);

    const { bucket } = getS3Config();
    const key = `avatars/${user.id}/${randomUUID()}.${extension}`;
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: contentType,
      Metadata: { owner: user.id },
    });
    const uploadUrl = await getSignedUrl(getS3Client(), command, { expiresIn: 15 * 60 });

    return successResponse({ uploadUrl, key }, "URL de upload gerada.");
  } catch (error: any) {
    if (error instanceof SyntaxError) return errorResponse("Corpo da requisição inválido.", 400);
    console.error("S3 upload URL error:", error);
    return errorResponse("Não foi possível preparar o upload.", 500);
  }
}
