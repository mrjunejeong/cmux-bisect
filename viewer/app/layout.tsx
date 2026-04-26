import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "cmux-bisect viewer",
  description: "git bisect for AI agent decisions — live bisection viewer",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
