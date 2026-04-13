/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Bind resources to your worker in `wrangler.jsonc`. After adding bindings, a type definition for the
 * `Env` object can be regenerated with `npm run cf-typegen`.
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

export interface Env {
  GEMINI_API_KEY: string;
  GROQ_API_KEY: string;
}
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "https://jabega69.github.io",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS_HEADERS });
    }
    const url = new URL(request.url);
    const path = url.pathname;
    try {
      if (path.startsWith("/api/gemini")) {
        return handleGemini(request, env);
      } else if (path.startsWith("/api/groq")) {
        return handleGroq(request, env);
      } else {
        return new Response(JSON.stringify({ error: "Not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json", ...CORS_HEADERS },
        });
      }
    } catch (error: any) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }
  },
};
async function handleGemini(request: Request, env: Env): Promise<Response> {
  const body: { contents: any; model?: string } = await request.json();
  const { contents, model = "gemini-2.5-flash" } = body;
  const targetUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.GEMINI_API_KEY}`;
  const response = await fetch(targetUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents }),
  });
  const data: any = await response.json();
  
  const usage = data.usageMetadata ? {
    promptTokens: data.usageMetadata.promptTokenCount || 0,
    completionTokens: data.usageMetadata.candidatesTokenCount || 0,
    totalTokens: data.usageMetadata.totalTokenCount || 0
  } : null;

  const responseBody = {
    ...data,
    _usage: usage
  };
  
  return new Response(JSON.stringify(responseBody), {
    status: response.status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}
async function handleGroq(request: Request, env: Env): Promise<Response> {
  const body: { messages: any; model?: string } = await request.json();
  const { messages, model = "meta-llama/llama-4-scout-17b-16e-instruct" } = body;
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({ messages, model, temperature: 0.1, max_tokens: 4096 }),
  });
  const data: any = await response.json();

  const usage = data.usage ? {
    promptTokens: data.usage.prompt_tokens || 0,
    completionTokens: data.usage.completion_tokens || 0,
    totalTokens: data.usage.total_tokens || 0
  } : null;

  const responseBody = {
    ...data,
    _usage: usage
  };
  
  return new Response(JSON.stringify(responseBody), {
    status: response.status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}