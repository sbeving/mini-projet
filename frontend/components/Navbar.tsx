"use client";

import { useAuth } from "@/lib/auth-context";
import {
  Activity,
  BarChart3,
  Bell,
  Bot,
  Database,
  LayoutDashboard,
  LogIn,
  LogOut,
  MessageSquare,
  Shield,
  User,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

/**
 * Navigation bar component
 */
export default function Navbar() {
  const pathname = usePathname();
  const { user, isAuthenticated, isAdmin, logout } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);

  // Don't show navbar on login page
  if (pathname === "/login") {
    return null;
  }

  const navItems = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/chat", label: "AI Chat", icon: MessageSquare },
  ];

  // Add admin links for admins
  if (isAdmin) {
    navItems.push({ href: "/admin", label: "Users", icon: Shield });
    navItems.push({ href: "/admin/log-sources", label: "Log Sources", icon: Database });
    navItems.push({ href: "/admin/analytics", label: "Analytics", icon: BarChart3 });
  }

  const handleLogout = async () => {
    setShowUserMenu(false);
    await logout();
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case "ADMIN":
        return "bg-red-500/20 text-red-400";
      case "STAFF":
        return "bg-blue-500/20 text-blue-400";
      default:
        return "bg-green-500/20 text-green-400";
    }
  };

  return (
    <nav className="border-b border-border bg-card">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <Activity className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold">LogChat</span>
          </Link>

          {/* Navigation Links */}
          <div className="flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`
                    flex items-center gap-2 px-4 py-2 rounded-lg transition-colors
                    ${
                      isActive
                        ? "bg-primary text-white"
                        : "text-muted-foreground hover:bg-card-hover hover:text-foreground"
                    }
                  `}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>

          {/* User Menu */}
          <div className="relative">
            {isAuthenticated && user ? (
              <>
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-card-hover transition-colors"
                >
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                    <User className="h-4 w-4 text-primary" />
                  </div>
                  <div className="hidden sm:block text-left">
                    <div className="text-sm font-medium">{user.name}</div>
                    <div
                      className={`text-xs px-1.5 py-0.5 rounded ${getRoleBadgeColor(
                        user.role
                      )}`}
                    >
                      {user.role}
                    </div>
                  </div>
                </button>

                {/* Dropdown Menu */}
                {showUserMenu && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setShowUserMenu(false)}
                    />
                    <div className="absolute right-0 mt-2 w-48 bg-card border border-border rounded-lg shadow-lg z-20 py-1">
                      <div className="px-4 py-2 border-b border-border">
                        <div className="font-medium">{user.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {user.email}
                        </div>
                      </div>
                      {isAdmin && (
                        <>
                          <Link
                            href="/admin"
                            onClick={() => setShowUserMenu(false)}
                            className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-card-hover transition-colors"
                          >
                            <Users className="h-4 w-4" />
                            User Management
                          </Link>
                          <Link
                            href="/admin/log-sources"
                            onClick={() => setShowUserMenu(false)}
                            className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-card-hover transition-colors"
                          >
                            <Database className="h-4 w-4" />
                            Log Sources
                          </Link>
                          <Link
                            href="/admin/analytics"
                            onClick={() => setShowUserMenu(false)}
                            className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-card-hover transition-colors"
                          >
                            <BarChart3 className="h-4 w-4" />
                            Analytics
                          </Link>
                          <Link
                            href="/admin/ai-settings"
                            onClick={() => setShowUserMenu(false)}
                            className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-card-hover transition-colors"
                          >
                            <Bot className="h-4 w-4" />
                            AI Settings
                          </Link>
                          <Link
                            href="/admin/notifications"
                            onClick={() => setShowUserMenu(false)}
                            className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-card-hover transition-colors"
                          >
                            <Bell className="h-4 w-4" />
                            Notifications
                          </Link>
                        </>
                      )}
                      <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                      >
                        <LogOut className="h-4 w-4" />
                        Sign Out
                      </button>
                    </div>
                  </>
                )}
              </>
            ) : (
              <Link
                href="/login"
                className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
              >
                <LogIn className="h-4 w-4" />
                <span>Sign In</span>
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
