'use client';

import Link from 'next/link';
import { Home, ArrowLeft, MessageCircle, Search, FileQuestion } from 'lucide-react';

export default function NotFoundPage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-32 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-accent/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: "1s" }}></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-error/5 rounded-full blur-3xl"></div>
      </div>

      <div className="text-center relative z-10 max-w-lg">
        {/* 404 Number with Animation */}
        <div className="relative mb-8">
          <h1 className="text-[180px] font-black text-foreground/5 leading-none select-none">404</h1>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-24 h-24 bg-gradient-to-br from-primary to-accent rounded-2xl flex items-center justify-center shadow-2xl shadow-primary/30 transform hover:scale-105 transition-transform">
              <FileQuestion className="w-12 h-12 text-white" />
            </div>
          </div>
        </div>

        {/* Error Message */}
        <h2 className="text-3xl font-bold text-foreground mb-4">
          Page Not Found
        </h2>
        <p className="text-lg text-muted mb-8 max-w-md mx-auto">
          Oops! The page you&apos;re looking for doesn&apos;t exist or has been moved. 
          Let&apos;s get you back on track.
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-primary to-accent text-white rounded-xl font-semibold hover:from-primary-dark hover:to-accent transition-all shadow-lg shadow-primary/25 hover:shadow-primary/40 transform hover:-translate-y-0.5"
          >
            <Home className="w-5 h-5" />
            Go to Dashboard
          </Link>
          <button
            onClick={() => window.history.back()}
            className="flex items-center gap-2 px-6 py-3 bg-surface border border-border text-foreground rounded-xl font-semibold hover:bg-surface-hover transition-all"
          >
            <ArrowLeft className="w-5 h-5" />
            Go Back
          </button>
        </div>

        {/* Quick Links */}
        <div className="mt-12 pt-8 border-t border-border">
          <p className="text-sm text-muted mb-4">Quick Links</p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/dashboard"
              className="flex items-center gap-2 px-4 py-2 text-sm text-muted hover:text-foreground transition-colors"
            >
              <Home className="w-4 h-4" />
              Dashboard
            </Link>
            <Link
              href="/chat"
              className="flex items-center gap-2 px-4 py-2 text-sm text-muted hover:text-foreground transition-colors"
            >
              <MessageCircle className="w-4 h-4" />
              Chat
            </Link>
            <Link
              href="/admin"
              className="flex items-center gap-2 px-4 py-2 text-sm text-muted hover:text-foreground transition-colors"
            >
              <Search className="w-4 h-4" />
              Admin
            </Link>
          </div>
        </div>

        {/* Fun Message */}
        <div className="mt-8 p-4 bg-surface/50 border border-border rounded-xl">
          <p className="text-sm text-muted">
            <span className="text-primary font-medium">Pro tip:</span> If you think this is a bug, 
            check the logs in the dashboard! 🔍
          </p>
        </div>
      </div>
    </div>
  );
}
