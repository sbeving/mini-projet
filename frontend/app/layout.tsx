import Navbar from "@/components/Navbar";
import { ToastProvider } from "@/components/Toast";
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LogChat - Log Analysis Dashboard",
  description: "AI-powered log analysis dashboard and chatbot",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-background text-foreground">
        <ToastProvider>
          <Navbar />
          <main className="container mx-auto px-4 py-6">{children}</main>
        </ToastProvider>
      </body>
    </html>
  );
}
