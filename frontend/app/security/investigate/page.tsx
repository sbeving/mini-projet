'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { getStoredToken } from '@/lib/api';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';

interface Investigation {
  id: string;
  threatId: string;
  status: 'open' | 'in_progress' | 'completed' | 'closed';
  title: string;
  summary: string;
  findings: Finding[];
  queries: Query[];
  createdAt: string;
  updatedAt: string;
}

interface Finding {
  id: string;
  type: 'observation' | 'anomaly' | 'indicator' | 'recommendation';
  title: string;
  description: string;
  severity: string;
  evidence?: string[];
  timestamp: string;
}

interface Query {
  id: string;
  question: string;
  answer: string;
  timestamp: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
}

interface Threat {
  id: string;
  title: string;
  type: string;
  severity: string;
  description: string;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const SUGGESTED_QUESTIONS = [
  "What are the key indicators of compromise in this threat?",
  "Analyze the attack chain and timeline",
  "What MITRE ATT&CK techniques are involved?",
  "Recommend immediate containment actions",
  "Are there related threats or patterns?",
  "What assets might be compromised?",
  "Provide a risk assessment summary",
  "What forensic evidence should we collect?",
];

export default function InvestigatePage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const threatId = searchParams.get('threat');
  
  const [threat, setThreat] = useState<Threat | null>(null);
  const [investigation, setInvestigation] = useState<Investigation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(true);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const fetchThreat = useCallback(async () => {
    const token = getStoredToken();
    if (!token || !threatId) return;
    
    try {
      const response = await fetch(`${API_BASE}/api/siem/threats/${threatId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setThreat(result.data);
          // Add initial system message
          setMessages([{
            id: 'system-1',
            role: 'system',
            content: `🔍 **AI Investigation Session Started**\n\nAnalyzing threat: **${result.data.title}**\n\nType: ${result.data.type} | Severity: ${result.data.severity.toUpperCase()}\n\nI'm ready to help you investigate this threat. You can ask me questions about the attack, request analysis, or get recommendations.`,
            timestamp: new Date(),
          }]);
        }
      }
    } catch (err) {
      console.error('Failed to fetch threat:', err);
    }
  }, [threatId]);

  const createInvestigation = useCallback(async () => {
    const token = getStoredToken();
    if (!token || !threatId) return null;
    
    try {
      const response = await fetch(`${API_BASE}/api/siem/investigate/${threatId}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          title: `Investigation for ${threat?.title || 'Unknown Threat'}` 
        }),
      });
      
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setInvestigation(result.data);
          return result.data;
        }
      }
    } catch (err) {
      console.error('Failed to create investigation:', err);
    }
    return null;
  }, [threatId, threat]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
      return;
    }
    if (threatId) {
      fetchThreat();
    }
  }, [authLoading, user, router, threatId, fetchThreat]);

  const askQuestion = async (question: string) => {
    const token = getStoredToken();
    if (!token || !threatId || isStreaming) return;
    
    setShowSuggestions(false);
    setIsStreaming(true);
    setError(null);
    
    // Add user message
    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: question,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    
    // Add placeholder for assistant response
    const assistantMessageId = `assistant-${Date.now()}`;
    setMessages(prev => [...prev, {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isStreaming: true,
    }]);

    try {
      // Ensure we have an investigation
      let inv = investigation;
      if (!inv) {
        inv = await createInvestigation();
      }
      
      const response = await fetch(`${API_BASE}/api/siem/investigate/ask`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          threatId,
          investigationId: inv?.id,
          question,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      // Handle streaming response
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let accumulatedContent = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') continue;
              
              try {
                const parsed = JSON.parse(data);
                if (parsed.content) {
                  accumulatedContent += parsed.content;
                  setMessages(prev => prev.map(m => 
                    m.id === assistantMessageId 
                      ? { ...m, content: accumulatedContent }
                      : m
                  ));
                }
              } catch {
                // Not JSON, might be plain text chunk
                accumulatedContent += data;
                setMessages(prev => prev.map(m => 
                  m.id === assistantMessageId 
                    ? { ...m, content: accumulatedContent }
                    : m
                ));
              }
            }
          }
        }
      }

      // If no streaming content, try to parse as regular JSON
      if (!accumulatedContent) {
        const result = await response.json();
        if (result.success && result.data?.answer) {
          accumulatedContent = result.data.answer;
          setMessages(prev => prev.map(m => 
            m.id === assistantMessageId 
              ? { ...m, content: accumulatedContent, isStreaming: false }
              : m
          ));
        }
      }

      // Mark streaming as complete
      setMessages(prev => prev.map(m => 
        m.id === assistantMessageId 
          ? { ...m, isStreaming: false }
          : m
      ));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get response');
      // Remove the empty assistant message
      setMessages(prev => prev.filter(m => m.id !== assistantMessageId));
    } finally {
      setIsStreaming(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim() && !isStreaming) {
      askQuestion(inputValue.trim());
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] text-white">
        <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
          <div className="w-12 h-12 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (!threatId) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] text-white">
        <div className="max-w-4xl mx-auto px-4 py-12 text-center">
          <span className="text-6xl mb-6 block">🔍</span>
          <h1 className="text-2xl font-bold mb-4">AI-Powered Investigation</h1>
          <p className="text-gray-400 mb-8">
            Select a threat from the security dashboard to start an AI investigation session.
          </p>
          <Link
            href="/security/threats"
            className="px-6 py-3 bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/30 rounded-lg inline-flex items-center gap-2 transition-all"
          >
            <span>🎯</span> View Threats
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white flex flex-col">
      
      <div className="flex-1 flex flex-col max-w-6xl mx-auto w-full px-4 py-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <Link href="/security/threats" className="p-2 hover:bg-gray-800 rounded-lg transition-colors">
              ← Back
            </Link>
            <div>
              <h1 className="text-xl font-bold flex items-center gap-2">
                <span>🔍</span> AI Investigation
              </h1>
              {threat && (
                <p className="text-sm text-gray-400">
                  {threat.title} • <span className={`${
                    threat.severity === 'critical' ? 'text-red-400' :
                    threat.severity === 'high' ? 'text-orange-400' :
                    threat.severity === 'medium' ? 'text-yellow-400' :
                    'text-blue-400'
                  }`}>{threat.severity.toUpperCase()}</span>
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {investigation && (
              <span className="text-xs px-2 py-1 bg-green-500/20 text-green-400 rounded">
                Investigation Active
              </span>
            )}
          </div>
        </div>

        {/* Chat Container */}
        <div className="flex-1 bg-[#12121a] border border-gray-800 rounded-xl overflow-hidden flex flex-col">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-xl p-4 ${
                    message.role === 'user'
                      ? 'bg-cyan-500/20 border border-cyan-500/30'
                      : message.role === 'system'
                      ? 'bg-purple-500/10 border border-purple-500/30'
                      : 'bg-[#1a1a24] border border-gray-700'
                  }`}
                >
                  {message.role === 'assistant' && (
                    <div className="flex items-center gap-2 mb-2 text-xs text-gray-500">
                      <span className="text-lg">🤖</span>
                      <span>AI Security Analyst</span>
                      {message.isStreaming && (
                        <span className="animate-pulse">typing...</span>
                      )}
                    </div>
                  )}
                  {message.role === 'system' && (
                    <div className="flex items-center gap-2 mb-2 text-xs text-purple-400">
                      <span className="text-lg">🛡️</span>
                      <span>System</span>
                    </div>
                  )}
                  <div className="prose prose-invert prose-sm max-w-none">
                    <ReactMarkdown>{message.content || '...'}</ReactMarkdown>
                  </div>
                  <div className="text-xs text-gray-600 mt-2 text-right">
                    {message.timestamp.toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Suggested Questions */}
          {showSuggestions && messages.length <= 1 && (
            <div className="p-4 border-t border-gray-800">
              <p className="text-sm text-gray-500 mb-3">💡 Suggested questions:</p>
              <div className="flex flex-wrap gap-2">
                {SUGGESTED_QUESTIONS.map((q, i) => (
                  <button
                    key={i}
                    onClick={() => askQuestion(q)}
                    className="px-3 py-1.5 text-sm bg-[#1a1a24] hover:bg-[#22222e] border border-gray-700 hover:border-cyan-500/30 rounded-lg transition-all"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="px-4 py-2 bg-red-500/10 border-t border-red-500/30 text-red-400 text-sm">
              ⚠️ {error}
            </div>
          )}

          {/* Input */}
          <form onSubmit={handleSubmit} className="p-4 border-t border-gray-800">
            <div className="flex gap-3">
              <textarea
                ref={inputRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask the AI analyst about this threat..."
                rows={1}
                className="flex-1 px-4 py-3 bg-[#1a1a24] border border-gray-700 rounded-xl focus:border-cyan-500 focus:outline-none resize-none"
                disabled={isStreaming}
              />
              <button
                type="submit"
                disabled={!inputValue.trim() || isStreaming}
                className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-600 hover:to-purple-600 disabled:from-gray-600 disabled:to-gray-700 rounded-xl font-medium transition-all flex items-center gap-2"
              >
                {isStreaming ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <span>🔍</span>
                    Investigate
                  </>
                )}
              </button>
            </div>
            <p className="text-xs text-gray-600 mt-2">
              Press Enter to send • Shift+Enter for new line • AI responses are based on threat context and security best practices
            </p>
          </form>
        </div>

        {/* Quick Actions Bar */}
        <div className="mt-4 flex items-center gap-4 flex-wrap">
          <button
            onClick={() => askQuestion("Give me a complete threat analysis summary")}
            disabled={isStreaming}
            className="px-4 py-2 bg-[#12121a] hover:bg-[#1a1a24] border border-gray-800 rounded-lg text-sm transition-all flex items-center gap-2"
          >
            📊 Full Analysis
          </button>
          <button
            onClick={() => askQuestion("What are the recommended containment actions?")}
            disabled={isStreaming}
            className="px-4 py-2 bg-[#12121a] hover:bg-[#1a1a24] border border-gray-800 rounded-lg text-sm transition-all flex items-center gap-2"
          >
            🛡️ Containment
          </button>
          <button
            onClick={() => askQuestion("Generate an incident report for this threat")}
            disabled={isStreaming}
            className="px-4 py-2 bg-[#12121a] hover:bg-[#1a1a24] border border-gray-800 rounded-lg text-sm transition-all flex items-center gap-2"
          >
            📄 Generate Report
          </button>
          <button
            onClick={() => askQuestion("Identify all related IOCs and affected assets")}
            disabled={isStreaming}
            className="px-4 py-2 bg-[#12121a] hover:bg-[#1a1a24] border border-gray-800 rounded-lg text-sm transition-all flex items-center gap-2"
          >
            🔴 IOCs & Assets
          </button>
        </div>
      </div>
    </div>
  );
}
