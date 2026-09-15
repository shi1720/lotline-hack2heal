import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Lotline | Recall response",
  description: "Account for recalled clinic stock with evidence before closure.",
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
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
