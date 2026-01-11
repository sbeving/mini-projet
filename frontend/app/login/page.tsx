"use client";

import { login } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { AlertCircle, Eye, EyeOff, Loader2, LogIn, Sparkles, MessageCircle, BarChart3 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";

export default function LoginPage() {
  const router = useRouter();
  const { setUserDirect, isAuthenticated, loading: authLoading, loginComplete } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [redirecting, setRedirecting] = useState(false);

  // Stable redirect function
  const navigateToDashboard = useCallback(() => {
    setRedirecting(true);
    window.location.href = "/dashboard";
  }, []);

  // Redirect if already logged in
  useEffect(() => {
    if (!authLoading && isAuthenticated && !redirecting) {
      navigateToDashboard();
    }
  }, [authLoading, isAuthenticated, redirecting, navigateToDashboard]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await login(email, password);
      
      if (result.success && result.user) {
        setUserDirect(result.user);
        loginComplete();
        setRedirecting(true);
        window.location.href = "/dashboard";
      } else {
        setError(result.error || "Login failed");
        setLoading(false);
      }
    } catch (err) {
      console.error("Login error:", err);
      setError("Network error. Please try again.");
      setLoading(false);
    }
  };

  // Show loading while checking auth
  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary border-t-transparent mx-auto"></div>
          <p className="text-muted mt-4">Loading...</p>
        </div>
      </div>
    );
  }

  // Show redirect state
  if (redirecting) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-success to-success-hover rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xl shadow-success/30">
            <Sparkles className="h-8 w-8 text-white animate-pulse" />
          </div>
          <h2 className="text-xl font-semibold text-foreground mb-2">Login Successful!</h2>
          <p className="text-muted">Redirecting to dashboard...</p>
          <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary border-t-transparent mx-auto mt-4"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Effects - Using theme colors */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-32 w-96 h-96 bg-primary/15 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-accent/15 rounded-full blur-3xl animate-pulse" style={{ animationDelay: "1s" }}></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-3xl"></div>
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Logo/Header */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-gradient-to-br from-primary to-accent rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-primary/30 transform hover:scale-105 transition-transform">
            <MessageCircle className="h-10 w-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-foreground">
            Welcome to LogChat
          </h1>
          <p className="text-muted mt-3 text-lg">AI-powered log analytics platform</p>
        </div>

        {/* Login Form */}
        <div className="bg-surface border border-border rounded-2xl p-8 shadow-2xl">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Error Alert */}
            {error && (
              <div className="flex items-center gap-3 p-4 bg-error/10 border border-error/20 text-error rounded-xl animate-shake">
                <AlertCircle className="h-5 w-5 flex-shrink-0" />
                <span className="text-sm font-medium">{error}</span>
              </div>
            )}

            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-foreground mb-2">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-background border border-border rounded-xl text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                placeholder="you@example.com"
                required
                autoComplete="email"
                disabled={loading}
              />
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-foreground mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-background border border-border rounded-xl text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all pr-12"
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted hover:text-foreground transition-colors"
                  disabled={loading}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-gradient-to-r from-primary to-accent text-white rounded-xl font-semibold hover:from-primary-dark hover:to-accent transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-primary/25 hover:shadow-primary/40 transform hover:-translate-y-0.5 active:translate-y-0"
            >
              {loading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Signing in...
                </>
              ) : (
                <>
                  <LogIn className="h-5 w-5" />
                  Sign In
                </>
              )}
            </button>
          </form>

          {/* Demo Credentials */}
          <div className="mt-8 pt-6 border-t border-border">
            <p className="text-sm text-muted text-center mb-4 font-medium">Quick Login (Demo)</p>
            <div className="grid grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => {
                  setEmail("admin@logchat.com");
                  setPassword("admin123");
                }}
                disabled={loading}
                className="p-3 bg-primary/10 border border-primary/20 rounded-xl hover:bg-primary/20 hover:border-primary/30 transition-all group disabled:opacity-50"
              >
                <div className="font-semibold text-primary group-hover:text-primary-light">Admin</div>
                <div className="text-xs text-muted mt-1">Full access</div>
              </button>
              <button
                type="button"
                onClick={() => {
                  setEmail("staff@logchat.com");
                  setPassword("staff123");
                }}
                disabled={loading}
                className="p-3 bg-info/10 border border-info/20 rounded-xl hover:bg-info/20 hover:border-info/30 transition-all group disabled:opacity-50"
              >
                <div className="font-semibold text-info group-hover:text-info-light">Staff</div>
                <div className="text-xs text-muted mt-1">Team access</div>
              </button>
              <button
                type="button"
                onClick={() => {
                  setEmail("test@logchat.com");
                  setPassword("test123");
                }}
                disabled={loading}
                className="p-3 bg-success/10 border border-success/20 rounded-xl hover:bg-success/20 hover:border-success/30 transition-all group disabled:opacity-50"
              >
                <div className="font-semibold text-success group-hover:text-success-light">User</div>
                <div className="text-xs text-muted mt-1">Basic access</div>
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-muted text-sm mt-6">Secure login • Powered by AI</p>
      </div>
    </div>
  );
}
