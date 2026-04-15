import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminEmail } from "@/lib/utils";

/**
 * Resolve the current admin row for the authenticated user.
 * Redirects to /login if not authenticated or not in allowlist.
 * Returns the admins.id (UUID) for use in audit logs / writes.
 */
export async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !user.email) {
    redirect("/login");
  }

  if (!isAdminEmail(user.email)) {
    await supabase.auth.signOut();
    redirect("/login?error=not_allowed");
  }

  // Look up the admin row (created on first login by /auth/callback)
  const adminDb = createAdminClient();
  const { data: admin } = await adminDb
    .from("admins")
    .select("id, email, role")
    .eq("auth_user_id", user.id)
    .single();

  if (!admin) {
    // Should not happen since callback creates the row, but defend anyway.
    redirect("/login?error=no_admin_row");
  }

  return {
    id: admin.id as string,
    email: admin.email as string,
    role: admin.role as "owner" | "editor" | "viewer",
    authUserId: user.id,
  };
}
