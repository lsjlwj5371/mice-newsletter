"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export const dynamic = "force-dynamic";

function LoginForm() {
  const params = useSearchParams();
  const next = params.get("next") ?? "/dashboard";
  const errorParam = params.get("error");

  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle"
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(
    errorParam === "not_allowed"
      ? "이 이메일은 관리자 허용 목록에 없습니다."
      : errorParam
      ? `로그인 오류: ${errorParam}`
      : null
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setErrorMsg(null);

    const supabase = createClient();
    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ?? window.location.origin;
    const redirectTo = `${appUrl}/auth/callback?next=${encodeURIComponent(next)}`;

    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: redirectTo,
        shouldCreateUser: true,
      },
    });

    if (error) {
      setStatus("error");
      setErrorMsg(error.message);
      return;
    }
    setStatus("sent");
  }

  return (
    <div className="w-full max-w-md bg-background border border-border rounded-2xl shadow-sm p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">
          MICE Newsletter Admin
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          관리자 이메일로 로그인 링크를 받습니다.
        </p>
      </div>

      {status === "sent" ? (
        <div className="rounded-md border border-border bg-muted/50 p-4 text-sm">
          <p className="font-medium">로그인 링크를 보냈습니다.</p>
          <p className="mt-1 text-muted-foreground">
            <span className="font-mono">{email}</span> 받은편지함에서 메일을
            열어 링크를 클릭하세요. 메일이 안 보이면 스팸함도 확인해 주세요.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium mb-1.5">
              이메일
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>

          {errorMsg && <p className="text-sm text-destructive">{errorMsg}</p>}

          <button
            type="submit"
            disabled={status === "sending"}
            className="w-full bg-primary text-primary-foreground rounded-md py-2.5 text-sm font-medium hover:opacity-90 disabled:opacity-50 transition"
          >
            {status === "sending" ? "전송 중..." : "매직링크 보내기"}
          </button>
        </form>
      )}

      <p className="mt-6 text-xs text-muted-foreground">
        허용 목록에 등록된 관리자 이메일만 접근할 수 있습니다.
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted px-4">
      <Suspense
        fallback={
          <div className="text-sm text-muted-foreground">불러오는 중...</div>
        }
      >
        <LoginForm />
      </Suspense>
    </div>
  );
}
