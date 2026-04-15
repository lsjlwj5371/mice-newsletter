"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/dashboard", label: "대시보드", icon: "▤" },
  { href: "/newsletters", label: "뉴스레터", icon: "✉" },
  { href: "/recipients", label: "수신자", icon: "👥" },
  { href: "/articles", label: "후보 기사", icon: "📰" },
  { href: "/rss", label: "RSS 피드", icon: "📡" },
  { href: "/history", label: "발송 이력", icon: "🗂" },
  { href: "/events", label: "이벤트·의견", icon: "💬" },
  { href: "/settings", label: "설정", icon: "⚙" },
] as const;

export function Sidebar({ adminEmail }: { adminEmail: string }) {
  const pathname = usePathname();

  return (
    <aside className="w-64 shrink-0 border-r border-border bg-background flex flex-col h-screen sticky top-0">
      <div className="px-5 py-5 border-b border-border">
        <div className="text-base font-semibold tracking-tight">
          MICE Newsletter
        </div>
        <div className="text-xs text-muted-foreground mt-0.5">Admin Console</div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        {NAV.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition",
                active
                  ? "bg-accent text-accent-foreground font-medium"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <span className="w-5 text-center">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border px-4 py-3 text-xs">
        <div className="text-muted-foreground mb-1">로그인 계정</div>
        <div className="font-mono truncate" title={adminEmail}>
          {adminEmail}
        </div>
        <form action="/auth/signout" method="post" className="mt-2">
          <button
            type="submit"
            className="text-xs text-muted-foreground hover:text-foreground underline"
          >
            로그아웃
          </button>
        </form>
      </div>
    </aside>
  );
}
