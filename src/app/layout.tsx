import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MICE Newsletter Admin",
  description: "내부용 뉴스레터 관리 시스템",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
