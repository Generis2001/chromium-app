/**
 * POST /api/setup
 *
 * One-time database schema initialisation.
 * Protected by a setup secret to prevent abuse.
 */

import { NextRequest, NextResponse } from "next/server";
import { sql, SCHEMA_SQL } from "@/lib/db";

export async function POST(req: NextRequest) {
  const auth = req.headers.get("x-setup-secret");
  if (auth !== process.env.SETUP_SECRET) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  try {
    const db = sql();
    await db.unsafe(SCHEMA_SQL);
    return NextResponse.json({ ok: true, message: "Schema initialised" });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Setup failed";
    console.error("[setup]", err);
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 },
    );
  }
}
