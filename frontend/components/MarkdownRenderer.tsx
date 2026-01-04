"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { AlertCircle, AlertTriangle, CheckCircle, Info, Lightbulb, Wrench, Zap, TrendingUp, Database, Clock, Server } from "lucide-react";

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

/**
 * Enhanced Markdown renderer with beautiful styling for AI chat responses
 * Includes special formatting for log analysis, recommendations, and alerts
 */
export default function MarkdownRenderer({ content, className = "" }: MarkdownRendererProps) {
  return (
    <div className={`markdown-content space-y-1 ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Headings with icons and better styling
          h1: ({ children }) => (
            <h1 className="text-xl font-bold mt-6 mb-3 first:mt-0 flex items-center gap-2 text-foreground border-b border-border/50 pb-2">
              <span className="text-primary">📊</span>
              {children}
            </h1>
          ),
          h2: ({ children }) => {
            const text = String(children).toLowerCase();
            const icon = getHeadingIcon(text);
            return (
              <h2 className="text-lg font-bold mt-5 mb-3 first:mt-0 flex items-center gap-2 text-foreground">
                {icon}
                {children}
              </h2>
            );
          },
          h3: ({ children }) => (
            <h3 className="text-base font-semibold mt-4 mb-2 first:mt-0 text-foreground/90">
              {children}
            </h3>
          ),
          h4: ({ children }) => (
            <h4 className="text-sm font-semibold mt-3 mb-1 first:mt-0 text-foreground/80">
              {children}
            </h4>
          ),

          // Paragraphs with special callout detection
          p: ({ children }) => {
            const text = String(children);
            // Check for special callout patterns
            if (text.startsWith("⚠️") || text.toLowerCase().startsWith("warning:")) {
              return (
                <div className="flex items-start gap-2 p-3 mb-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                  <AlertTriangle className="h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                  <p className="text-yellow-200/90 leading-relaxed">{children}</p>
                </div>
              );
            }
            if (text.startsWith("❌") || text.toLowerCase().startsWith("error:")) {
              return (
                <div className="flex items-start gap-2 p-3 mb-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                  <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <p className="text-red-200/90 leading-relaxed">{children}</p>
                </div>
              );
            }
            if (text.startsWith("✅")) {
              return (
                <div className="flex items-start gap-2 p-3 mb-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                  <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <p className="text-green-200/90 leading-relaxed">{children}</p>
                </div>
              );
            }
            if (text.startsWith("💡") || text.toLowerCase().startsWith("tip:")) {
              return (
                <div className="flex items-start gap-2 p-3 mb-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                  <Lightbulb className="h-5 w-5 text-blue-400 flex-shrink-0 mt-0.5" />
                  <p className="text-blue-200/90 leading-relaxed">{children}</p>
                </div>
              );
            }
            return (
              <p className="mb-3 last:mb-0 leading-relaxed text-foreground/90">{children}</p>
            );
          },

          // Enhanced Lists with visual indicators
          ul: ({ children }) => (
            <ul className="mb-4 space-y-2 ml-1">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="mb-4 space-y-3 ml-1">{children}</ol>
          ),
          li: ({ children }) => {
            const text = String(children);
            // Detect issue severity from content
            const isError = text.toLowerCase().includes("error") || 
                           text.toLowerCase().includes("exhausted") || 
                           text.toLowerCase().includes("failed") ||
                           text.toLowerCase().includes("critical") ||
                           text.toLowerCase().includes("fatal");
            const isWarning = text.toLowerCase().includes("warning") || 
                             text.toLowerCase().includes("slow") || 
                             text.toLowerCase().includes("high memory") ||
                             text.toLowerCase().includes("rate limit") ||
                             text.toLowerCase().includes("timeout");
            
            // Get appropriate styling based on severity
            let bulletClass = "bg-primary/20 text-primary";
            let bgClass = "";
            let bulletContent: React.ReactNode = "•";
            
            if (isError) {
              bulletClass = "bg-red-500/20 text-red-400";
              bgClass = "bg-red-500/5 border-l-2 border-red-500/50";
              bulletContent = <AlertCircle className="h-3 w-3" />;
            } else if (isWarning) {
              bulletClass = "bg-yellow-500/20 text-yellow-400";
              bgClass = "bg-yellow-500/5 border-l-2 border-yellow-500/50";
              bulletContent = <AlertTriangle className="h-3 w-3" />;
            }
            
            return (
              <li className={`flex items-start gap-3 ${bgClass} ${bgClass ? 'p-2 rounded-lg -ml-1' : ''}`}>
                <span className={`flex-shrink-0 w-5 h-5 rounded-full ${bulletClass} flex items-center justify-center text-xs mt-0.5`}>
                  {bulletContent}
                </span>
                <span className="leading-relaxed flex-1 text-foreground/90">{children}</span>
              </li>
            );
          },

          // Code blocks with language indicator
          code: ({ className, children, ...props }) => {
            const isInline = !className;
            if (isInline) {
              return (
                <code className="bg-primary/15 text-primary-light px-1.5 py-0.5 rounded text-sm font-mono border border-primary/20">
                  {children}
                </code>
              );
            }
            const language = className?.replace("language-", "") || "";
            return (
              <div className="relative my-3">
                {language && (
                  <div className="absolute top-0 right-0 px-2 py-1 text-xs text-muted bg-surface-hover rounded-bl-lg rounded-tr-lg border-l border-b border-border">
                    {language}
                  </div>
                )}
                <code
                  className="block bg-[#0d1117] border border-border rounded-xl p-4 text-sm font-mono overflow-x-auto whitespace-pre text-green-400"
                  {...props}
                >
                  {children}
                </code>
              </div>
            );
          },
          pre: ({ children }) => (
            <pre className="bg-[#0d1117] border border-border rounded-xl overflow-x-auto my-3">
              {children}
            </pre>
          ),

          // Blockquotes as info callouts
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-primary bg-primary/5 pl-4 pr-3 py-3 my-4 rounded-r-lg">
              <div className="flex items-start gap-2">
                <Info className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                <div className="text-foreground/90 italic">{children}</div>
              </div>
            </blockquote>
          ),

          // Enhanced Tables
          table: ({ children }) => (
            <div className="overflow-x-auto my-4 rounded-xl border border-border shadow-lg">
              <table className="min-w-full divide-y divide-border">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-surface">{children}</thead>
          ),
          tbody: ({ children }) => (
            <tbody className="divide-y divide-border bg-card">{children}</tbody>
          ),
          tr: ({ children }) => (
            <tr className="hover:bg-surface-hover transition-colors">{children}</tr>
          ),
          th: ({ children }) => (
            <th className="px-4 py-3 text-left text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              {children}
            </th>
          ),
          td: ({ children }) => {
            const text = String(children);
            // Highlight error/warning values in table cells
            let textClass = "";
            if (text.toLowerCase().includes("error") || text.toLowerCase().includes("fatal") || text.toLowerCase().includes("critical")) {
              textClass = "text-red-400 font-medium";
            } else if (text.toLowerCase().includes("warn") || text.toLowerCase().includes("slow")) {
              textClass = "text-yellow-400 font-medium";
            } else if (text.toLowerCase().includes("success") || text.toLowerCase().includes("ok")) {
              textClass = "text-green-400 font-medium";
            }
            return (
              <td className={`px-4 py-3 text-sm ${textClass}`}>{children}</td>
            );
          },

          // Links with better styling
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:text-primary-hover underline underline-offset-2 decoration-primary/50 hover:decoration-primary transition-colors"
            >
              {children}
            </a>
          ),

          // Horizontal rule as gradient divider
          hr: () => (
            <hr className="my-6 border-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
          ),

          // Strong text
          strong: ({ children }) => (
            <strong className="font-bold text-foreground">{children}</strong>
          ),
          
          // Emphasized text
          em: ({ children }) => (
            <em className="italic text-foreground/80">{children}</em>
          ),

          // Strikethrough
          del: ({ children }) => (
            <del className="line-through text-muted-foreground opacity-70">{children}</del>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

/**
 * Get appropriate icon for heading based on content keywords
 */
function getHeadingIcon(text: string): React.ReactNode {
  if (text.includes("recommendation") || text.includes("suggest") || text.includes("solution")) {
    return <Lightbulb className="h-5 w-5 text-yellow-400" />;
  }
  if (text.includes("error") || text.includes("issue") || text.includes("problem")) {
    return <AlertCircle className="h-5 w-5 text-red-400" />;
  }
  if (text.includes("warning") || text.includes("caution")) {
    return <AlertTriangle className="h-5 w-5 text-yellow-400" />;
  }
  if (text.includes("performance") || text.includes("metric") || text.includes("stat")) {
    return <TrendingUp className="h-5 w-5 text-blue-400" />;
  }
  if (text.includes("database") || text.includes("connection") || text.includes("pool")) {
    return <Database className="h-5 w-5 text-purple-400" />;
  }
  if (text.includes("slow") || text.includes("latency") || text.includes("timeout")) {
    return <Clock className="h-5 w-5 text-orange-400" />;
  }
  if (text.includes("service") || text.includes("server") || text.includes("api")) {
    return <Server className="h-5 w-5 text-cyan-400" />;
  }
  if (text.includes("fix") || text.includes("optimize") || text.includes("improve")) {
    return <Wrench className="h-5 w-5 text-green-400" />;
  }
  if (text.includes("summary") || text.includes("overview") || text.includes("analysis")) {
    return <Zap className="h-5 w-5 text-primary" />;
  }
  return <span className="text-primary">▸</span>;
}
