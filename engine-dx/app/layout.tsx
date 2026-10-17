import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "한화엔진 구매 DX · 3D 기술협의",
  description: "6G50ME-C9.6 시연 모델 기반 부품별 구매 기술협의와 검토·회신·후속 조치",
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
