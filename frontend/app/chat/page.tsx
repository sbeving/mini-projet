"use client";

import MarkdownRenderer from "@/components/MarkdownRenderer";
import { useToast } from "@/components/Toast";
import {
    ChatFilters,
    ChatMessage,
    checkOllamaHealth,
    fetchChatSuggestions,
    fetchServices,
    sendChatMessage,
} from "@/lib/api";
import {
    AlertCircle,
    Bot,
    Download,
    History,
    Loader2,
    MessageSquare,
    RotateCcw,
    Send,
    Sparkles,
    Trash2,
    User,
    X
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

type TimeRange = "15m" | "1h" | "6h" | "24h" | "7d";

interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  timestamp: Date;
}

const STORAGE_KEY = "logchat_history";

/**
 * Chat page - AI-powered log analysis chatbot with history & export
 */
export default function ChatPage() {
  const { addToast } = useToast();
  
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [services, setServices] = useState<string[]>([]);
  const [ollamaStatus, setOllamaStatus] = useState<{
    available: boolean;
    model: string;
  } | null>(null);
  
  // History
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

  // Filters
  const [filters, setFilters] = useState<ChatFilters>({
    timeRange: "1h",
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load history from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        setSessions(parsed.map((s: any) => ({
          ...s,
          timestamp: new Date(s.timestamp),
          messages: s.messages.map((m: any) => ({
            ...m,
            timestamp: new Date(m.timestamp),
          })),
        })));
      }
    } catch (err) {
      console.error("Failed to load chat history:", err);
    }
  }, []);

  // Save to localStorage when sessions change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
    } catch (err) {
      console.error("Failed to save chat history:", err);
    }
  }, [sessions]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Fetch initial data
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

    loadInitialData();
  }, []);

  // Save current session
  const saveCurrentSession = () => {
    if (messages.length === 0) return;

    const title = messages[0].content.substring(0, 50) + (messages[0].content.length > 50 ? "..." : "");
    const sessionId = currentSessionId || Date.now().toString();
    
    const session: ChatSession = {
      id: sessionId,
      title,
      messages: [...messages],
      timestamp: new Date(),
    };

    setSessions((prev) => {
      const existing = prev.findIndex((s) => s.id === sessionId);
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = session;
        return updated;
      }
      return [session, ...prev].slice(0, 20); // Keep last 20 sessions
    });

    setCurrentSessionId(sessionId);
  };

  // Load session
  const loadSession = (session: ChatSession) => {
    setMessages(session.messages);
    setCurrentSessionId(session.id);
    setShowHistory(false);
    addToast({
      type: "info",
      title: "Session Loaded",
      message: session.title,
      duration: 3000,
    });
  };

  // Delete session
  const deleteSession = (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    if (currentSessionId === sessionId) {
      setCurrentSessionId(null);
    }
    addToast({
      type: "success",
      title: "Session Deleted",
      duration: 2000,
    });
  };

  // Start new chat
  const startNewChat = () => {
    if (messages.length > 0) {
      saveCurrentSession();
    }
    setMessages([]);
    setCurrentSessionId(null);
    inputRef.current?.focus();
  };

  // Export as Markdown
  const exportAsMarkdown = () => {
    if (messages.length === 0) return;

    const md = `# Log Analysis Chat Export
Generated: ${new Date().toLocaleString()}
Filters: ${filters.timeRange} | ${filters.service || "All Services"} | ${filters.level || "All Levels"}

---

${messages.map((m) => `### ${m.role === "user" ? "You" : "AI Assistant"}
${m.content}
${m.context ? `\n*Analyzed ${m.context.logsAnalyzed} logs from ${m.context.timeRange}*` : ""}
`).join("\n---\n\n")}
`;

    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `log-analysis-${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);

    addToast({
      type: "success",
      title: "Export Complete",
      message: "Chat exported as Markdown",
      duration: 3000,
    });
  };

  // Send message handler
  const handleSend = async (messageText?: string) => {
    const text = messageText || input.trim();
    if (!text || loading) return;

    // Add user message
    const userMessage: ChatMessage = {
      role: "user",
      content: text,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const response = await sendChatMessage(text, filters);

      // Add assistant message
      const assistantMessage: ChatMessage = {
        role: "assistant",
        content: response.response,
        timestamp: new Date(),
        context: response.context,
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      // Add error message
      const errorMessage: ChatMessage = {
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

  // Handle suggestion click
  const handleSuggestionClick = (suggestion: string) => {
    handleSend(suggestion);
  };

  // Handle key press
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Bot className="h-8 w-8 text-primary" />
            Log Analyst Chat
          </h1>
          <p className="text-muted-foreground">
            Ask questions about your application logs
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* History Button */}
          <button
            onClick={() => setShowHistory(!showHistory)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              showHistory
                ? "bg-primary text-white"
                : "bg-card border border-border hover:border-primary/50"
            }`}
          >
            <History className="h-4 w-4" />
            History
            {sessions.length > 0 && (
              <span className="text-xs bg-primary/20 px-1.5 py-0.5 rounded">
                {sessions.length}
              </span>
            )}
          </button>

          {/* Export Button */}
          <button
            onClick={exportAsMarkdown}
            disabled={messages.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-card border border-border rounded-lg hover:border-primary/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Download className="h-4 w-4" />
            Export
          </button>

          {/* New Chat */}
          <button
            onClick={startNewChat}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
          >
            <RotateCcw className="h-4 w-4" />
            New Chat
          </button>

          {/* Ollama Status */}
          <div className="flex items-center gap-2 px-3 py-2 bg-card rounded-lg border border-border">
            <div
              className={`w-2 h-2 rounded-full ${
                ollamaStatus?.available ? "bg-green-500 animate-pulse" : "bg-red-500"
              }`}
            ></div>
            <span className="text-sm text-muted-foreground">
              {ollamaStatus?.available
                ? ollamaStatus.model
                : "AI Offline"}
            </span>
          </div>
        </div>
      </div>

      {/* History Sidebar */}
      {showHistory && (
        <div className="absolute right-4 top-32 z-40 w-80 bg-card border border-border rounded-lg shadow-xl animate-scale-in">
          <div className="flex items-center justify-between p-3 border-b border-border">
            <h3 className="font-semibold flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Chat History
            </h3>
            <button onClick={() => setShowHistory(false)} className="p-1 hover:bg-border rounded">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {sessions.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground text-center">
                No saved conversations yet
              </p>
            ) : (
              sessions.map((session) => (
                <div
                  key={session.id}
                  onClick={() => loadSession(session)}
                  className={`p-3 border-b border-border hover:bg-primary/5 cursor-pointer group ${
                    currentSessionId === session.id ? "bg-primary/10" : ""
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{session.title}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {session.messages.length} messages •{" "}
                        {new Date(session.timestamp).toLocaleDateString()}
                      </p>
                    </div>
                    <button
                      onClick={(e) => deleteSession(session.id, e)}
                      className="p-1 opacity-0 group-hover:opacity-100 hover:text-red-500 transition-all"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-4 mb-4 p-4 bg-card rounded-lg border border-border">
        <span className="text-sm text-muted-foreground">Analyze logs from:</span>
        
        {/* Time Range */}
        <select
          value={filters.timeRange}
          onChange={(e) =>
            setFilters((f) => ({ ...f, timeRange: e.target.value as TimeRange }))
          }
          className="bg-background border border-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="15m">Last 15 minutes</option>
          <option value="1h">Last hour</option>
          <option value="6h">Last 6 hours</option>
          <option value="24h">Last 24 hours</option>
          <option value="7d">Last 7 days</option>
        </select>

        {/* Service Filter */}
        <select
          value={filters.service || ""}
          onChange={(e) =>
            setFilters((f) => ({
              ...f,
              service: e.target.value || undefined,
            }))
          }
          className="bg-background border border-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="">All Services</option>
          {services.map((service) => (
            <option key={service} value={service}>
              {service}
            </option>
          ))}
        </select>

        {/* Level Filter */}
        <select
          value={filters.level || ""}
          onChange={(e) =>
            setFilters((f) => ({
              ...f,
              level: e.target.value || undefined,
            }))
          }
          className="bg-background border border-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="">All Levels</option>
          <option value="ERROR">Errors Only</option>
          <option value="WARN">Warnings & Errors</option>
        </select>
      </div>

      {/* Chat Container */}
      <div className="flex-1 bg-card rounded-lg border border-border overflow-hidden flex flex-col">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center">
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-6">
                <Bot className="h-10 w-10 text-primary" />
              </div>
              <h2 className="text-xl font-semibold mb-2">Log Analysis Assistant</h2>
              <p className="text-muted-foreground mb-6 max-w-md">
                I can help you understand your application logs, identify issues,
                and explain error patterns. Try asking a question!
              </p>

              {/* Suggestions */}
              {suggestions.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground mb-2">
                    <Sparkles className="inline h-4 w-4 mr-1" />
                    Suggested questions:
                  </p>
                  <div className="flex flex-wrap justify-center gap-2">
                    {suggestions.map((suggestion, i) => (
                      <button
                        key={i}
                        onClick={() => handleSuggestionClick(suggestion)}
                        className="px-3 py-2 bg-background border border-border rounded-lg text-sm hover:border-primary hover:bg-primary/5 transition-all hover-lift"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            messages.map((message, i) => (
              <div
                key={i}
                className={`flex gap-3 message-enter ${
                  message.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                {message.role === "assistant" && (
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Bot className="h-4 w-4 text-primary" />
                  </div>
                )}
                <div
                  className={`max-w-2xl rounded-lg px-4 py-3 ${
                    message.role === "user"
                      ? "bg-primary text-white"
                      : "bg-background border border-border"
                  }`}
                >
                  {message.role === "assistant" ? (
                    <MarkdownRenderer content={message.content} />
                  ) : (
                    <p className="whitespace-pre-wrap">{message.content}</p>
                  )}
                  
                  {/* Context info for assistant messages */}
                  {message.context && (
                    <div className="mt-3 pt-3 border-t border-border/50 text-xs text-muted-foreground flex items-center gap-2">
                      <Activity className="h-3 w-3" />
                      Analyzed {message.context.logsAnalyzed} logs from the last{" "}
                      {message.context.timeRange}
                    </div>
                  )}
                </div>
                {message.role === "user" && (
                  <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                    <User className="h-4 w-4 text-white" />
                  </div>
                )}
              </div>
            ))
          )}

          {/* Loading indicator */}
          {loading && (
            <div className="flex gap-3 justify-start message-enter">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Bot className="h-4 w-4 text-primary" />
              </div>
              <div className="bg-background border border-border rounded-lg px-4 py-3">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Analyzing logs...</span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-4 border-t border-border">
          {!ollamaStatus?.available && (
            <div className="flex items-center gap-2 text-amber-500 text-sm mb-3">
              <AlertCircle className="h-4 w-4" />
              <span>
                AI service is not available. Chat functionality may be limited.
              </span>
            </div>
          )}
          <div className="flex gap-3">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about your logs..."
              disabled={loading}
              className="flex-1 bg-background border border-border rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
            />
            <button
              onClick={() => handleSend()}
              disabled={loading || !input.trim()}
              className="px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              <Send className="h-4 w-4" />
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Missing import
function Activity({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
    </svg>
  );
}
