/**
 * POST /api/contracts/addresses
 *
 * Returns the deployed contract addresses (public info, no auth required).
 */

import { NextResponse } from "next/server";
import { getContractAddresses } from "@/lib/genlayer/client";

export async function GET() {
  return NextResponse.json({
    ok: true,
    data: getContractAddresses(),
  });
}
