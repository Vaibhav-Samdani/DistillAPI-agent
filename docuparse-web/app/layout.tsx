// app/layout.tsx
import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geist = Geist({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "DistillAPI",
  description: "Research Paper Summarizer",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // ADD suppressHydrationWarning HERE
    <html lang="en" suppressHydrationWarning> 
      {/* AND ADD IT HERE */}
      <body className={`${geist.className}`} suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}