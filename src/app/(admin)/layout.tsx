import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/utils";
import { Sidebar } from "@/components/admin/sidebar";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !user.email) {
    redirect("/login");
  }

  if (!isAdminEmail(user.email)) {
    // Defense-in-depth: middleware allows authenticated users through;
    // here we re-check the allowlist server-side.
    await supabase.auth.signOut();
    redirect("/login?error=not_allowed");
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar adminEmail={user.email} />
      <main className="flex-1 min-w-0 bg-muted/30">{children}</main>
    </div>
  );
}
