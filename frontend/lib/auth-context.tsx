"use client";

import {
  clearAuth,
  getCurrentUser,
  getStoredToken,
  getStoredUser,
  logout as apiLogout,
  User,
} from "@/lib/api";
import { useRouter, usePathname } from "next/navigation";
import { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isStaff: boolean;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  setUserDirect: (user: User | null) => void;
  loginComplete: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const hasRedirected = useRef(false);

  const refreshUser = useCallback(async () => {
    try {
      const token = getStoredToken();
      if (!token) {
        setUser(null);
        return;
      }

      const currentUser = await getCurrentUser();
      setUser(currentUser);
    } catch {
      setUser(null);
      clearAuth();
    }
  }, []);

  const setUserDirect = useCallback((newUser: User | null) => {
    setUser(newUser);
    setLoading(false);
  }, []);

  // Called after login to trigger navigation
  const loginComplete = useCallback(() => {
    hasRedirected.current = false;
  }, []);

  useEffect(() => {
    setMounted(true);
    
    // Initial load from localStorage
    const storedUser = getStoredUser();
    const token = getStoredToken();
    
    if (storedUser && token) {
      setUser(storedUser);
      setLoading(false);
      // Verify with server in background (don't block UI)
      refreshUser();
    } else {
      setLoading(false);
    }
  }, [refreshUser]);

  const logout = async () => {
    setLoading(true);
    await apiLogout();
    setUser(null);
    setLoading(false);
    hasRedirected.current = true;
    router.push("/login");
  };

  const value: AuthContextType = {
    user,
    loading: loading || !mounted,
    isAuthenticated: !!user,
    isAdmin: user?.role === "ADMIN",
    isStaff: user?.role === "STAFF" || user?.role === "ADMIN",
    logout,
    refreshUser,
    setUserDirect,
    loginComplete,
  };

  // Prevent hydration mismatch by not rendering until mounted
  if (!mounted) {
    return (
      <AuthContext.Provider value={value}>
        <div className="min-h-screen bg-background" />
      </AuthContext.Provider>
    );
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

/**
 * HOC to protect routes
 */
export function withAuth<P extends object>(
  Component: React.ComponentType<P>,
  options?: { requiredRole?: "ADMIN" | "STAFF" | "USER" }
) {
  return function AuthenticatedComponent(props: P) {
    const { user, loading, isAuthenticated } = useAuth();
    const router = useRouter();

    useEffect(() => {
      if (!loading && !isAuthenticated) {
        router.push("/login");
      }

      if (!loading && isAuthenticated && options?.requiredRole) {
        const roleHierarchy = { USER: 0, STAFF: 1, ADMIN: 2 };
        const userLevel = roleHierarchy[user?.role || "USER"];
        const requiredLevel = roleHierarchy[options.requiredRole];

        if (userLevel < requiredLevel) {
          router.push("/dashboard");
        }
      }
    }, [loading, isAuthenticated, user, router]);

    if (loading) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      );
    }

    if (!isAuthenticated) {
      return null;
    }

    return <Component {...props} />;
  };
}
