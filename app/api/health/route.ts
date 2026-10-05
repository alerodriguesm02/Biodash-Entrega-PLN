import { NextRequest, NextResponse } from 'next/server'
const logger = require("@/lib/logger-winston");

export async function GET(req: NextRequest) {
  try {
    logger.info("Health check called");
    return NextResponse.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'biodash-backend',
      version: '1.0.0'
    })
  } catch (error: any) {
    logger.error("Health check failed", { error: error.message });
    return NextResponse.json(
      { 
        status: 'error', 
        message: 'Health check failed',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}