"use client";

import { useAuth } from "@/lib/auth-context";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

interface TrackActivityOptions {
  type:
    | "LOGIN"
    | "LOGOUT"
    | "PAGE_VIEW"
    | "CHAT_MESSAGE"
    | "CHAT_START"
    | "LOG_VIEW"
    | "LOG_SEARCH"
    | "SETTINGS_CHANGE"
    | "API_CALL"
    | "OTHER";
  path?: string;
  duration?: number;
  meta?: Record<string, unknown>;
}

/**
 * Hook to track user activity for analytics
 */
export function useActivity() {
  const { isAuthenticated } = useAuth();
  const pathname = usePathname();
  const pageLoadTime = useRef<number>(Date.now());
  const lastTrackedPath = useRef<string | null>(null);

  // Track activity function
  const trackActivity = useCallback(
    async (options: TrackActivityOptions) => {
      if (!isAuthenticated) return;

      try {
        const token = localStorage.getItem("token");
        if (!token) return;

        await fetch(`${API_URL}/api/admin/analytics/track`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            type: options.type,
            path: options.path || pathname,
            duration: options.duration,
            meta: options.meta,
          }),
        });
      } catch (err) {
        // Silently fail - don't break user experience for analytics
        console.debug("Activity tracking failed:", err);
      }
    },
    [isAuthenticated, pathname]
  );

  // Track page views automatically
  useEffect(() => {
    if (!isAuthenticated) return;
    if (lastTrackedPath.current === pathname) return;

    // Track the page view
    lastTrackedPath.current = pathname;
    pageLoadTime.current = Date.now();
    trackActivity({ type: "PAGE_VIEW", path: pathname });

    // Track duration when leaving the page
    return () => {
      const duration = Date.now() - pageLoadTime.current;
      if (duration > 1000) {
        // Only track if > 1 second
        trackActivity({
          type: "PAGE_VIEW",
          path: pathname,
          duration,
          meta: { action: "leave" },
        });
      }
    };
  }, [pathname, isAuthenticated, trackActivity]);

  return { trackActivity };
}

/**
 * Track chat-related activities
 */
export function useChatActivity() {
  const { trackActivity } = useActivity();

  const trackChatStart = useCallback(
    (sessionId?: string) => {
      trackActivity({
        type: "CHAT_START",
        meta: { sessionId },
      });
    },
    [trackActivity]
  );

  const trackChatMessage = useCallback(
    (sessionId: string, messageLength: number) => {
      trackActivity({
        type: "CHAT_MESSAGE",
        meta: { sessionId, messageLength },
      });
    },
    [trackActivity]
  );

  return { trackChatStart, trackChatMessage };
}

/**
 * Track log-related activities
 */
export function useLogActivity() {
  const { trackActivity } = useActivity();

  const trackLogView = useCallback(
    (logId: string) => {
      trackActivity({
        type: "LOG_VIEW",
        meta: { logId },
      });
    },
    [trackActivity]
  );

  const trackLogSearch = useCallback(
    (query: string, filters: Record<string, unknown>) => {
      trackActivity({
        type: "LOG_SEARCH",
        meta: { query, filters },
      });
    },
    [trackActivity]
  );

  return { trackLogView, trackLogSearch };
}
