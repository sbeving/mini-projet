/**
 * Ollama Service
 * Client for interacting with local Ollama LLM API
 */

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'qwen2.5:3b';

// System prompt for log analysis
const LOG_ANALYST_SYSTEM_PROMPT = `You are a log analysis assistant. You are given application logs and high-level statistics from a system. Your job is to explain what is happening, highlight anomalies, and answer questions clearly and concisely.

You must:
- Identify main issues, failures, or anomalies in the logs
- Summarize error patterns by service and time
- Suggest probable root causes based only on the provided logs
- Be specific and reference actual log entries when relevant
- Keep responses focused and actionable

Do NOT:
- Invent events that are not supported by the logs
- Make assumptions about infrastructure not mentioned in logs
- Provide generic advice unrelated to the actual log content

Format your response in clear sections if the answer requires multiple points.`;

interface OllamaResponse {
  model: string;
  created_at: string;
  response: string;
  done: boolean;
  context?: number[];
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  eval_count?: number;
  eval_duration?: number;
}

interface OllamaError {
  error: string;
}

/**
 * Check if Ollama service is available
 */
export async function checkOllamaHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${OLLAMA_URL}/api/tags`);
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * List available models in Ollama
 */
export async function listModels(): Promise<string[]> {
  try {
    const response = await fetch(`${OLLAMA_URL}/api/tags`);
    if (!response.ok) return [];
    
    const data = await response.json() as { models?: Array<{ name: string }> };
    return (data.models || []).map((m) => m.name);
  } catch {
    return [];
  }
}

/**
 * Call Ollama API with a prompt (non-streaming)
 */
export async function callOllama(prompt: string, systemPrompt?: string): Promise<string> {
  const body = {
    model: OLLAMA_MODEL,
    prompt,
    system: systemPrompt || LOG_ANALYST_SYSTEM_PROMPT,
    stream: false,
    options: {
      temperature: 0.7,
      top_p: 0.9,
      num_predict: 1024,
    },
  };

  console.log(`[Ollama] Calling model ${OLLAMA_MODEL}...`);
  const startTime = Date.now();

  try {
    const response = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorData = await response.json() as OllamaError;
      throw new Error(`Ollama API error: ${errorData.error || response.statusText}`);
    }

    const data = await response.json() as OllamaResponse;
    const duration = Date.now() - startTime;
    console.log(`[Ollama] Response received in ${duration}ms`);

    return data.response;
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new Error(`Cannot connect to Ollama at ${OLLAMA_URL}. Make sure Ollama is running.`);
    }
    throw error;
  }
}

/**
 * Build a prompt for log analysis
 */
export function buildLogAnalysisPrompt(
  logs: Array<{ timestamp: Date; level: string; service: string; message: string }>,
  stats: string,
  userQuestion: string
): string {
  // Format logs for the prompt (limit to avoid token overflow)
  const maxLogs = 50;
  const logSample = logs.slice(0, maxLogs);
  
  let logsText = '';
  if (logSample.length > 0) {
    logsText = '\n[LOG SAMPLES]\n';
    for (const log of logSample) {
      const ts = log.timestamp instanceof Date ? log.timestamp.toISOString() : log.timestamp;
      logsText += `[${ts}] [${log.level}] ${log.service}: ${log.message}\n`;
    }
    if (logs.length > maxLogs) {
      logsText += `... and ${logs.length - maxLogs} more logs\n`;
    }
  } else {
    logsText = '\n[LOG SAMPLES]\nNo logs found for the specified criteria.\n';
  }

  const prompt = `
[LOG STATS]
${stats}
${logsText}
[USER QUESTION]
${userQuestion}

Based on the log statistics and samples above, please answer the user's question.
`.trim();

  return prompt;
}

/**
 * Analyze logs using Ollama
 */
export async function analyzeLogs(
  logs: Array<{ timestamp: Date; level: string; service: string; message: string }>,
  stats: string,
  userQuestion: string
): Promise<string> {
  const prompt = buildLogAnalysisPrompt(logs, stats, userQuestion);
  
  try {
    const response = await callOllama(prompt);
    return response;
  } catch (error) {
    console.error('[Ollama] Analysis failed:', error);
    
    // Provide a fallback response with basic stats if Ollama fails
    if (logs.length === 0) {
      return `I couldn't connect to the AI model, but I can tell you that no logs were found matching your criteria.`;
    }
    
    const errorCount = logs.filter(l => l.level === 'ERROR' || l.level === 'FATAL').length;
    return `I couldn't connect to the AI model for detailed analysis, but here's what I found:
    
- Total logs in sample: ${logs.length}
- Errors/Fatal: ${errorCount}

${stats}

Please try again later when the AI model is available.`;
  }
}

export { LOG_ANALYST_SYSTEM_PROMPT };
