import "server-only";

import { S3Client } from "@aws-sdk/client-s3";

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Variável de ambiente obrigatória ausente: ${name}`);
  return value;
}

export function getS3Config() {
  return {
    region: requireEnv("AWS_REGION"),
    bucket: requireEnv("AWS_BUCKET_NAME"),
  };
}

export function getS3Client() {
  const { region } = getS3Config();
  return new S3Client({ region });
}
