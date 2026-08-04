import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tasker",
  description: "Agency project management, time tracking, and invoicing.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // The Todoist-style system font stack is set in globals.css, so no
    // webfont (previously Geist) is loaded at all.
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
