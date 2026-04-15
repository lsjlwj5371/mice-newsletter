import { redirect } from "next/navigation";

export default function RootPage() {
  // Middleware will redirect to /login if not authenticated.
  redirect("/dashboard");
}
