import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "한화엔진 구매 DX · 엔진 부품 재고",
  description: "6G50ME-C9.6 시연 모델에서 부품을 선택해 가상(SAMPLE) 재고를 확인",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="antialiased">{children}</body>
    </html>
  );
}
