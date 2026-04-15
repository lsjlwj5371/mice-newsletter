import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminEmail } from "@/lib/utils";
import { logAudit } from "@/lib/audit";

/**
 * Supabase magic-link callback.
 * Exchanges the OTP code for a session, then enforces the admin allowlist:
 *   - allowed → upsert into `admins` table, redirect to `next` (default /dashboard)
 *   - not allowed → sign out + redirect to /login?error=not_allowed
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/dashboard";

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=missing_code", url));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(error.message)}`, url)
    );
  }

  // Get the freshly authenticated user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !user.email) {
    return NextResponse.redirect(new URL("/login?error=no_user", url));
  }

  // Allowlist check
  if (!isAdminEmail(user.email)) {
    await supabase.auth.signOut();
    return NextResponse.redirect(new URL("/login?error=not_allowed", url));
  }

  // Upsert admin record + record login time
  const adminDb = createAdminClient();
  const { data: admin } = await adminDb
    .from("admins")
    .upsert(
      {
        auth_user_id: user.id,
        email: user.email,
        last_login_at: new Date().toISOString(),
      },
      { onConflict: "email" }
    )
    .select("id")
    .single();

  await logAudit({
    adminId: admin?.id ?? null,
    action: "auth.login",
    entity: "admin",
    entityId: admin?.id ?? user.id,
    metadata: { email: user.email },
  });

  return NextResponse.redirect(new URL(next, url));
}
