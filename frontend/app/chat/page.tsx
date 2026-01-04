"use client";

import MarkdownRenderer from "@/components/MarkdownRenderer";
import { useToast } from "@/components/Toast";
import {
    addChatMessage,
    archiveChatSession,
    ChatFilters,
    ChatSessionSummary,
    checkOllamaHealth,
    createChatSession,
    deleteChatSession,
    fetchChatSession,
    fetchChatSessions,
    fetchChatSuggestions,
    fetchServices,
    sendChatMessage,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import {
    Archive,
    Bot,
    Clock,
    Download,
    Filter,
    History,
    Loader2,
    Menu,
    MessageSquare,
    Plus,
    Search,
    Send,
    Sparkles,
    Trash2,
    User,
    X,
    Zap
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

type TimeRange = "15m" | "1h" | "6h" | "24h" | "7d";

interface LocalMessage {
  id?: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  responseTime?: number;
  context?: {
    logsAnalyzed: number;
    timeRange: string;
    sampleLogs?: Array<{
      timestamp: string;
      level: string;
      service: string;
      message: string;
    }>;
  };
}

export default function ChatPage() {
  const router = useRouter();
  const { isAuthenticated, loading: authLoading, user } = useAuth();
  const { addToast } = useToast();
  
  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [sessionTitle, setSessionTitle] = useState<string>("New Chat");
  
  const [sessions, setSessions] = useState<ChatSessionSummary[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [showSidebar, setShowSidebar] = useState(true);
  
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [services, setServices] = useState<string[]>([]);
  const [ollamaStatus, setOllamaStatus] = useState<{
    available: boolean;
    model: string;
  } | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const [filters, setFilters] = useState<ChatFilters>({
    timeRange: "1h",
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 150) + "px";
  };

  const loadSessions = useCallback(async () => {
    try {
      setSessionsLoading(true);
      const data = await fetchChatSessions({ limit: 50 });
      setSessions(data.sessions);
    } catch (err) {
      console.error("Failed to load sessions:", err);
    } finally {
      setSessionsLoading(false);
    }
  }, []);

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const [suggestionsData, servicesData, healthData] = await Promise.all([
          fetchChatSuggestions(),
          fetchServices(),
          checkOllamaHealth(),
        ]);
        setSuggestions(suggestionsData);
        setServices(servicesData);
        setOllamaStatus({
          available: healthData.available,
          model: healthData.configured_model,
        });
      } catch (err) {
        console.error("Failed to load initial chat data:", err);
      }
    };

    if (isAuthenticated) {
      loadInitialData();
      loadSessions();
    }
  }, [isAuthenticated, loadSessions]);

  const loadSession = async (sessionId: string) => {
    try {
      setLoading(true);
      const session = await fetchChatSession(sessionId);
      
      setMessages(session.messages.map((m: { id: string; role: string; content: string; createdAt: string; responseTime?: number }) => ({
        id: m.id,
        role: m.role as "user" | "assistant",
        content: m.content,
        timestamp: new Date(m.createdAt),
        responseTime: m.responseTime,
      })));
      setCurrentSessionId(session.id);
      setSessionTitle(session.title);
      
      if (window.innerWidth < 768) {
        setShowSidebar(false);
      }
    } catch {
      addToast({
        type: "error",
        title: "Failed to load session",
        duration: 3000,
      });
    } finally {
      setLoading(false);
    }
  };

  const startNewChat = () => {
    setMessages([]);
    setCurrentSessionId(null);
    setSessionTitle("New Chat");
    inputRef.current?.focus();
  };

  const handleDeleteSession = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deleteChatSession(sessionId);
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      if (currentSessionId === sessionId) {
        startNewChat();
      }
      addToast({
        type: "success",
        title: "Session deleted",
        duration: 2000,
      });
    } catch {
      addToast({
        type: "error",
        title: "Failed to delete session",
        duration: 3000,
      });
    }
  };

  const handleArchiveSession = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await archiveChatSession(sessionId);
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      addToast({
        type: "success",
        title: "Session archived",
        duration: 2000,
      });
    } catch {
      addToast({
        type: "error",
        title: "Failed to archive session",
        duration: 3000,
      });
    }
  };

  const exportAsMarkdown = () => {
    if (messages.length === 0) return;

    const md = `# Log Analysis Chat Export
Generated: ${new Date().toLocaleString()}
Session: ${sessionTitle}

---

${messages.map((m) => `## ${m.role === "user" ? "You" : "AI Assistant"}
${m.content}
${m.context ? `\n*Analyzed ${m.context.logsAnalyzed} logs from ${m.context.timeRange}*` : ""}
`).join("\n---\n\n")}
`;

    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `chat-export-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);

    addToast({
      type: "success",
      title: "Export complete",
      message: "Chat exported as Markdown",
      duration: 3000,
    });
  };

  const handleSend = async (messageText?: string) => {
    const text = messageText || input.trim();
    if (!text || loading) return;

    let sessionId = currentSessionId;
    if (!sessionId) {
      try {
        const newSession = await createChatSession();
        sessionId = newSession.id;
        setCurrentSessionId(sessionId);
        setSessionTitle(newSession.title);
        loadSessions();
      } catch {
        addToast({
          type: "error",
          title: "Failed to create session",
          duration: 3000,
        });
        return;
      }
    }

    const userMessage: LocalMessage = {
      role: "user",
      content: text,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
    }
    setLoading(true);

    const startTime = Date.now();

    try {
      await addChatMessage(sessionId, {
        role: "user",
        content: text,
      });

      const response = await sendChatMessage(text, filters);
      const responseTime = Date.now() - startTime;

      const assistantMessage: LocalMessage = {
        role: "assistant",
        content: response.response,
        timestamp: new Date(),
        responseTime,
        context: response.context,
      };
      setMessages((prev) => [...prev, assistantMessage]);

      await addChatMessage(sessionId, {
        role: "assistant",
        content: response.response,
        responseTime,
      });

      loadSessions();
    } catch (err) {
      const errorMessage: LocalMessage = {
        role: "assistant",
        content: `Sorry, I encountered an error: ${
          err instanceof Error ? err.message : "Unknown error"
        }. Please try again.`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
      
      addToast({
        type: "error",
        title: "Chat Error",
        message: err instanceof Error ? err.message : "Unknown error",
        duration: 5000,
      });
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatTime = (date: Date) => {
    return new Intl.DateTimeFormat("en", {
      hour: "numeric",
      minute: "2-digit",
    }).format(date);
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center animate-pulse">
            <Bot className="h-6 w-6 text-white" />
          </div>
          <p className="text-muted">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="flex h-[calc(100vh-5rem)] -mx-4 -mt-6 bg-background">
      {/* Sidebar */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-40 w-80 bg-card border-r border-border
          transform transition-transform duration-300 ease-out
          ${showSidebar ? "translate-x-0" : "-translate-x-full"}
          md:relative md:translate-x-0
        `}
        style={{ top: "4rem" }}
      >
        <div className="flex flex-col h-full">
          {/* Sidebar Header */}
          <div className="p-4 border-b border-border">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <History className="h-5 w-5 text-primary" />
                History
              </h2>
              <button
                onClick={() => setShowSidebar(false)}
                className="p-2 hover:bg-surface-hover rounded-lg md:hidden"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <button
              onClick={startNewChat}
              className="w-full btn btn-primary"
            >
              <Plus className="h-4 w-4" />
              New Chat
            </button>
          </div>

          {/* Sessions List */}
          <div className="flex-1 overflow-y-auto p-2">
            {sessionsLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="p-3 rounded-xl skeleton h-20" />
                ))}
              </div>
            ) : sessions.length === 0 ? (
              <div className="text-center py-12 px-4">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-surface-hover flex items-center justify-center">
                  <MessageSquare className="h-8 w-8 text-muted" />
                </div>
                <p className="text-muted font-medium">No conversations yet</p>
                <p className="text-sm text-muted/70 mt-1">Start a new chat to begin</p>
              </div>
            ) : (
              <div className="space-y-1">
                {sessions.map((session) => (
                  <div
                    key={session.id}
                    onClick={() => loadSession(session.id)}
                    className={`
                      group p-3 rounded-xl cursor-pointer transition-all duration-200
                      ${currentSessionId === session.id
                        ? "bg-primary/10 border border-primary/30"
                        : "hover:bg-surface-hover border border-transparent"
                      }
                    `}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate text-sm">{session.title}</p>
                        <p className="text-xs text-muted mt-1 flex items-center gap-1.5">
                          <MessageSquare className="h-3 w-3" />
                          {session.messageCount} messages
                        </p>
                      </div>
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => handleArchiveSession(session.id, e)}
                          className="p-1.5 hover:bg-warning/20 rounded-lg text-warning"
                          title="Archive"
                        >
                          <Archive className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={(e) => handleDeleteSession(session.id, e)}
                          className="p-1.5 hover:bg-error/20 rounded-lg text-error"
                          title="Delete"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                    <p className="text-xs text-muted/70 mt-2">
                      {new Date(session.updatedAt).toLocaleDateString()}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Sidebar Footer */}
          <div className="p-4 border-t border-border">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                <User className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{user?.name}</p>
                <p className="text-xs text-muted truncate">{user?.email}</p>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Overlay for mobile */}
      {showSidebar && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={() => setShowSidebar(false)}
        />
      )}

      {/* Main Chat Area */}
      <main className="flex-1 flex flex-col min-w-0 bg-gradient-to-b from-background to-card/30">
        {/* Chat Header */}
        <header className="flex items-center justify-between px-4 py-3 border-b border-border bg-card/80 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowSidebar(!showSidebar)}
              className="p-2 hover:bg-surface-hover rounded-xl md:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div>
              <h1 className="font-semibold flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                {sessionTitle}
              </h1>
              <p className="text-xs text-muted">
                {currentSessionId ? `${messages.length} messages` : "New conversation"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {ollamaStatus && (
              <div
                className={`
                  hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium
                  ${ollamaStatus.available
                    ? "bg-success/10 text-success border border-success/20"
                    : "bg-error/10 text-error border border-error/20"
                  }
                `}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${
                  ollamaStatus.available ? "bg-success animate-pulse" : "bg-error"
                }`} />
                {ollamaStatus.available ? ollamaStatus.model : "Offline"}
              </div>
            )}

            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`p-2 rounded-xl transition-colors ${
                showFilters ? "bg-primary/10 text-primary" : "hover:bg-surface-hover"
              }`}
              title="Filters"
            >
              <Filter className="h-5 w-5" />
            </button>

            <button
              onClick={exportAsMarkdown}
              disabled={messages.length === 0}
              className="p-2 hover:bg-surface-hover rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
              title="Export"
            >
              <Download className="h-5 w-5" />
            </button>
          </div>
        </header>

        {/* Filters Bar */}
        {showFilters && (
          <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-b border-border bg-surface/50 animate-slide-up">
            <span className="text-sm text-muted font-medium">Analyze logs from:</span>
            <select
              value={filters.timeRange}
              onChange={(e) => setFilters((f) => ({ ...f, timeRange: e.target.value as TimeRange }))}
              className="input py-1.5 px-3 text-sm w-auto"
            >
              <option value="15m">Last 15 min</option>
              <option value="1h">Last hour</option>
              <option value="6h">Last 6 hours</option>
              <option value="24h">Last 24 hours</option>
              <option value="7d">Last 7 days</option>
            </select>
            <select
              value={filters.service || ""}
              onChange={(e) => setFilters((f) => ({ ...f, service: e.target.value || undefined }))}
              className="input py-1.5 px-3 text-sm w-auto"
            >
              <option value="">All Services</option>
              {services.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <select
              value={filters.level || ""}
              onChange={(e) => setFilters((f) => ({ ...f, level: e.target.value || undefined }))}
              className="input py-1.5 px-3 text-sm w-auto"
            >
              <option value="">All Levels</option>
              <option value="DEBUG">DEBUG</option>
              <option value="INFO">INFO</option>
              <option value="WARN">WARN</option>
              <option value="ERROR">ERROR</option>
              <option value="FATAL">FATAL</option>
            </select>
          </div>
        )}

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full p-6 text-center">
              <div className="relative mb-8">
                <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                  <Bot className="h-12 w-12 text-primary" />
                </div>
                <div className="absolute -bottom-2 -right-2 w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center animate-float">
                  <Sparkles className="h-5 w-5 text-white" />
                </div>
              </div>
              
              <h2 className="text-2xl font-bold mb-2">
                <span className="gradient-text">AI Log Analyst</span>
              </h2>
              <p className="text-muted mb-8 max-w-md">
                Ask me anything about your logs. I can help you find errors,
                identify patterns, and troubleshoot issues.
              </p>

              <div className="grid sm:grid-cols-2 gap-3 max-w-2xl w-full">
                {suggestions.slice(0, 4).map((suggestion, i) => (
                  <button
                    key={i}
                    onClick={() => handleSend(suggestion)}
                    className="group p-4 text-left bg-card hover:bg-card-hover border border-border hover:border-primary/30 rounded-2xl transition-all duration-200 card-hover"
                  >
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-primary/10 rounded-xl group-hover:bg-primary/20 transition-colors">
                        <Zap className="h-4 w-4 text-primary" />
                      </div>
                      <span className="text-sm leading-relaxed">{suggestion}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
              {messages.map((message, i) => (
                <div
                  key={i}
                  className={`flex gap-3 message-enter ${
                    message.role === "user" ? "flex-row-reverse" : ""
                  }`}
                >
                  <div
                    className={`
                      flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center
                      ${message.role === "assistant"
                        ? "bg-gradient-to-br from-primary to-accent"
                        : "bg-surface-hover"
                      }
                    `}
                  >
                    {message.role === "assistant" ? (
                      <Bot className="h-5 w-5 text-white" />
                    ) : (
                      <User className="h-5 w-5" />
                    )}
                  </div>

                  <div className={`max-w-[80%] space-y-2 ${message.role === "user" ? "items-end" : ""}`}>
                    <div
                      className={`
                        px-4 py-3 
                        ${message.role === "user"
                          ? "chat-bubble-user"
                          : "chat-bubble-assistant"
                        }
                      `}
                    >
                      {message.role === "assistant" ? (
                        <div className="prose prose-sm max-w-none">
                          <MarkdownRenderer content={message.content} />
                        </div>
                      ) : (
                        <p className="whitespace-pre-wrap">{message.content}</p>
                      )}
                    </div>

                    <div className={`flex items-center gap-3 text-xs text-muted ${
                      message.role === "user" ? "justify-end" : ""
                    }`}>
                      {message.context && (
                        <span className="flex items-center gap-1">
                          <Search className="h-3 w-3" />
                          {message.context.logsAnalyzed} logs analyzed
                        </span>
                      )}
                      {message.responseTime && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {(message.responseTime / 1000).toFixed(1)}s
                        </span>
                      )}
                      <span>{formatTime(message.timestamp)}</span>
                    </div>
                  </div>
                </div>
              ))}

              {loading && (
                <div className="flex gap-3 message-enter">
                  <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                    <Bot className="h-5 w-5 text-white" />
                  </div>
                  <div className="chat-bubble-assistant px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      <span className="text-muted">Analyzing logs...</span>
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="p-4 border-t border-border bg-card/80 backdrop-blur-sm">
          <div className="max-w-4xl mx-auto">
            <div className="relative flex items-end gap-3 bg-surface border border-border rounded-2xl p-2 focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/20 transition-all">
              <textarea
                ref={inputRef}
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder={loading ? "Analyzing..." : "Ask about your logs... (Enter to send, Shift+Enter for new line)"}
                disabled={loading}
                rows={1}
                className="flex-1 bg-transparent border-0 resize-none focus:outline-none focus:ring-0 py-2 px-2 text-foreground placeholder:text-muted max-h-[150px]"
              />
              <button
                onClick={() => handleSend()}
                disabled={!input.trim() || loading}
                className="flex-shrink-0 p-2.5 bg-gradient-to-r from-primary to-accent text-white rounded-xl disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg hover:shadow-primary/25 transition-all"
              >
                {loading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Send className="h-5 w-5" />
                )}
              </button>
            </div>
            <p className="text-xs text-muted text-center mt-2">
              AI responses are based on your log data and may vary
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
