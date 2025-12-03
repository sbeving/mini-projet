"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

/**
 * Markdown renderer component with styled elements for chat messages
 */
export default function MarkdownRenderer({ content, className = "" }: MarkdownRendererProps) {
  return (
    <div className={`markdown-content ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
        // Headings
        h1: ({ children }) => (
          <h1 className="text-xl font-bold mt-4 mb-2 first:mt-0">{children}</h1>
        ),
        h2: ({ children }) => (
          <h2 className="text-lg font-bold mt-3 mb-2 first:mt-0">{children}</h2>
        ),
        h3: ({ children }) => (
          <h3 className="text-base font-semibold mt-3 mb-1 first:mt-0">{children}</h3>
        ),
        h4: ({ children }) => (
          <h4 className="text-sm font-semibold mt-2 mb-1 first:mt-0">{children}</h4>
        ),

        // Paragraphs
        p: ({ children }) => (
          <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>
        ),

        // Lists
        ul: ({ children }) => (
          <ul className="list-disc list-inside mb-2 space-y-1 ml-2">{children}</ul>
        ),
        ol: ({ children }) => (
          <ol className="list-decimal list-inside mb-2 space-y-1 ml-2">{children}</ol>
        ),
        li: ({ children }) => (
          <li className="leading-relaxed">{children}</li>
        ),

        // Code blocks
        code: ({ className, children, ...props }) => {
          const isInline = !className;
          if (isInline) {
            return (
              <code className="bg-primary/10 text-primary px-1.5 py-0.5 rounded text-sm font-mono">
                {children}
              </code>
            );
          }
          return (
            <code
              className="block bg-background/80 border border-border rounded-lg p-3 my-2 text-sm font-mono overflow-x-auto whitespace-pre"
              {...props}
            >
              {children}
            </code>
          );
        },
        pre: ({ children }) => (
          <pre className="bg-background/80 border border-border rounded-lg p-3 my-2 overflow-x-auto">
            {children}
          </pre>
        ),

        // Blockquotes
        blockquote: ({ children }) => (
          <blockquote className="border-l-4 border-primary/50 pl-4 py-1 my-2 italic text-muted-foreground">
            {children}
          </blockquote>
        ),

        // Tables
        table: ({ children }) => (
          <div className="overflow-x-auto my-2">
            <table className="min-w-full border border-border rounded-lg overflow-hidden">
              {children}
            </table>
          </div>
        ),
        thead: ({ children }) => (
          <thead className="bg-primary/10">{children}</thead>
        ),
        tbody: ({ children }) => (
          <tbody className="divide-y divide-border">{children}</tbody>
        ),
        tr: ({ children }) => (
          <tr className="hover:bg-primary/5 transition-colors">{children}</tr>
        ),
        th: ({ children }) => (
          <th className="px-3 py-2 text-left text-sm font-semibold">{children}</th>
        ),
        td: ({ children }) => (
          <td className="px-3 py-2 text-sm">{children}</td>
        ),

        // Links
        a: ({ href, children }) => (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            {children}
          </a>
        ),

        // Horizontal rule
        hr: () => <hr className="my-4 border-border" />,

        // Strong and emphasis
        strong: ({ children }) => (
          <strong className="font-semibold">{children}</strong>
        ),
        em: ({ children }) => (
          <em className="italic">{children}</em>
        ),

        // Strikethrough
        del: ({ children }) => (
          <del className="line-through text-muted-foreground">{children}</del>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
    </div>
  );
}
