import { NextResponse, type NextRequest } from "next/server";
import { scanAndMarkBounces } from "@/lib/gmail/bounce-scan";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function unauthorized() {
  return NextResponse.json(
    { ok: false, error: "Unauthorized" },
    { status: 401 }
  );
}

function authorize(req: NextRequest): boolean {
  const auth = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${process.env.CRON_SECRET ?? ""}`;
  return Boolean(process.env.CRON_SECRET) && auth === expected;
}

async function run(): Promise<NextResponse> {
  const result = await scanAndMarkBounces({
    maxResults: 50,
    // Look back 10 days by default so a missed daily run still catches up
    sinceIso: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
  });
  return NextResponse.json(result);
}

export async function GET(req: NextRequest) {
  if (!authorize(req)) return unauthorized();
  return run();
}
export async function POST(req: NextRequest) {
  if (!authorize(req)) return unauthorized();
  return run();
}
