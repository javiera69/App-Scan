export type AIProvider = 'gemini' | 'groq';

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface TokenUsageData {
  gemini: TokenUsage;
  groq: TokenUsage;
  lastUpdated: number;
}

const STORAGE_KEY = 'tokenUsage';

const getStoredUsage = (): TokenUsageData => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.warn('Failed to read token usage from localStorage', e);
  }
  return { gemini: { promptTokens: 0, completionTokens: 0, totalTokens: 0 }, groq: { promptTokens: 0, completionTokens: 0, totalTokens: 0 }, lastUpdated: Date.now() };
};

const saveUsage = (data: TokenUsageData) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn('Failed to save token usage to localStorage', e);
  }
};

const addUsage = (provider: AIProvider, usage: TokenUsage) => {
  const current = getStoredUsage();
  current[provider] = {
    promptTokens: current[provider].promptTokens + usage.promptTokens,
    completionTokens: current[provider].completionTokens + usage.completionTokens,
    totalTokens: current[provider].totalTokens + usage.totalTokens,
  };
  current.lastUpdated = Date.now();
  saveUsage(current);
};

export const getTokenUsage = (): TokenUsageData => getStoredUsage();

export const resetTokenUsage = () => {
  saveUsage({ gemini: { promptTokens: 0, completionTokens: 0, totalTokens: 0 }, groq: { promptTokens: 0, completionTokens: 0, totalTokens: 0 }, lastUpdated: Date.now() });
};

const WORKER_URL = 'https://ai-proxy.jbetanzos1.workers.dev';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function callWithRetry<T>(fn: () => Promise<T>, maxRetries = 3, initialDelay = 2000): Promise<T> {
    let lastError: any;
    for (let i = 0; i <= maxRetries; i++) {
        try {
            return await fn();
        } catch (error: any) {
            lastError = error;
            const msg = error?.message || '';
            const isRateLimit = msg.includes('429') || error?.status === 429 || error?.code === 429 || msg.includes('rate_limit');
            const isOverload = msg.includes('503') || error?.status === 503 || msg.includes('UNAVAILABLE') || msg.includes('high demand');

            if ((isRateLimit || isOverload) && i < maxRetries) {
                const waitTime = initialDelay * Math.pow(2, i);
                console.warn(`${isRateLimit ? 'Rate Limit (429)' : 'Overload (503)'}. Retrying in ${waitTime}ms... (Attempt ${i + 1}/${maxRetries})`);
                await delay(waitTime);
                continue;
            }
            throw error;
        }
    }
    throw lastError;
}

// --- GEMINI IMPLEMENTATION ---

const extractTextWithGemini = async (base64Data: string, mimeType: string): Promise<string> => {
    return callWithRetry(async () => {
        const response = await fetch(`${WORKER_URL}/api/gemini`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    role: 'user',
                    parts: [
                        { inlineData: { mimeType: mimeType, data: base64Data } },
                        { text: "Transcribe el texto de este documento exactamente como aparece. Mantén la estructura (listas, encabezados) usando Markdown. No incluyas ningún texto de introducción o cierre." }
                    ]
                }]
            })
        });
        const data: any = await response.json().catch(() => ({}));
        if (!response.ok || data.error) {
            const msg = data.error?.message || `Gemini error (${response.status})`;
            const status = data.error?.status || '';
            throw new Error(`${response.status}: ${status} ${msg}`.trim());
        }
        if (data._usage) {
            addUsage('gemini', data._usage);
        }
        return data.candidates?.[0]?.content?.parts?.[0]?.text || "No se pudo extraer ningún texto.";
    });
};

const analyzeWithGemini = async (text: string, base64Data?: string, mimeType?: string): Promise<string> => {
    return callWithRetry(async () => {
        const parts: any[] = [
            { text: `Analiza el contenido de este documento:\n\n${text}\n\nProporciona un resumen estructurado que incluya:\n1. Tipo de Documento\n2. Fechas Clave\n3. Entidades Principales (Personas/Empresas)\n4. Tareas Pendientes o Resumen` }
        ];

        if (base64Data && mimeType) {
            parts.unshift({ inlineData: { mimeType: mimeType, data: base64Data } });
        }

        const response = await fetch(`${WORKER_URL}/api/gemini`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ role: 'user', parts }]
            })
        });

        const data: any = await response.json().catch(() => ({}));
        if (!response.ok || data.error) {
            const msg = data.error?.message || `Gemini error (${response.status})`;
            const status = data.error?.status || '';
            throw new Error(`${response.status}: ${status} ${msg}`.trim());
        }
        if (data._usage) {
            addUsage('gemini', data._usage);
        }
        return data.candidates?.[0]?.content?.parts?.[0]?.text || "El análisis falló.";
    });
};

// --- GROQ IMPLEMENTATION ---

const GROQ_VISION_MODELS = [
    'llama-3.2-11b-vision-instant',
    'llama-3.2-90b-vision-instant',
    'meta-llama/llama-4-scout-17b-16e-instruct',
];

const shouldRetryNextModel = (message?: string): boolean => {
    if (!message) return false;
    return message.includes('decommissioned')
        || message.includes('not found')
        || message.includes('does not exist')
        || message.includes('do not have access')
        || message.includes('invalid image data');
};

const extractTextWithGroq = async (base64Data: string, mimeType: string): Promise<string> => {
    return callWithRetry(async () => {
        if (mimeType.includes('pdf')) {
            throw new Error("Groq no admite archivos PDF para visión. Por favor, usa el proveedor Gemini.");
        }

        let lastError: any;

        for (const model of GROQ_VISION_MODELS) {
            try {
                const response = await fetch(`${WORKER_URL}/api/groq`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        model,
                        messages: [{
                            role: 'user',
                            content: [
                                { type: 'text', text: "Transcribe el texto de este documento exactamente como aparece. Mantén la estructura (listas, encabezados) usando Markdown. No incluyas ningún texto de introducción o cierre." },
                                { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64Data}` } }
                            ]
                        }],
                        temperature: 0.1,
                        max_tokens: 4096
                    })
                });

                if (response.status === 400 || response.status === 403 || response.status === 404) {
                    const errorData: any = await response.json().catch(() => ({}));
                    const errMsg = errorData.error?.message || '';
                    console.warn(`Groq model ${model} failed (${response.status}): ${errMsg}. Trying next...`);
                    lastError = new Error(errMsg || `Model ${model} failed`);
                    continue;
                }

                if (!response.ok) {
                    const error: any = await response.json().catch(() => ({}));
                    throw new Error(error.error?.message || `Error en Groq API (${response.status})`);
                }

                const data: any = await response.json().catch(() => ({}));

                // Check for error in body even on 200 (proxy may not forward status)
                if (data.error) {
                    const errMsg = data.error.message || `Groq error (model: ${model})`;
                    console.warn(`Groq model ${model} returned error: ${errMsg}. Trying next...`);
                    lastError = new Error(errMsg);
                    continue;
                }

                if (data._usage) {
                    addUsage('groq', data._usage);
                }
                return data.choices?.[0]?.message?.content || "No se pudo extraer ningún texto.";
            } catch (e: any) {
                lastError = e;
                if (shouldRetryNextModel(e.message)) continue;
                throw e;
            }
        }
        throw lastError || new Error("No se pudo encontrar un modelo de Groq compatible.");
    });
};

const analyzeWithGroq = async (text: string, base64Data?: string, mimeType?: string): Promise<string> => {
    return callWithRetry(async () => {
        const content: any[] = [
            { type: 'text', text: `Analiza el contenido de este documento:\n\n${text}\n\nProporciona un resumen estructurado que incluya:\n1. Tipo de Documento\n2. Fechas Clave\n3. Entidades Principales (Personas/Empresas)\n4. Tareas Pendientes o Resumen` }
        ];

        if (base64Data && mimeType) {
            content.push({ type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64Data}` } });
        }

        if (mimeType?.includes('pdf')) {
            throw new Error("Groq no admite archivos PDF para visión. Por favor, usa el proveedor Gemini.");
        }

        let lastError: any;

        for (const model of GROQ_VISION_MODELS) {
            try {
                const response = await fetch(`${WORKER_URL}/api/groq`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        model,
                        messages: [{ role: 'user', content }],
                        temperature: 0.1,
                        max_tokens: 4096
                    })
                });

                if (response.status === 400 || response.status === 403 || response.status === 404) {
                    const errorData: any = await response.json().catch(() => ({}));
                    const errMsg = errorData.error?.message || '';
                    console.warn(`Groq model ${model} failed (${response.status}): ${errMsg}. Trying next...`);
                    lastError = new Error(errMsg || `Model ${model} failed`);
                    continue;
                }

                if (!response.ok) {
                    const error: any = await response.json().catch(() => ({}));
                    throw new Error(error.error?.message || `Error en Groq API (${response.status})`);
                }

                const data: any = await response.json().catch(() => ({}));

                // Check for error in body even on 200 (proxy may not forward status)
                if (data.error) {
                    const errMsg = data.error.message || `Groq error (model: ${model})`;
                    console.warn(`Groq model ${model} returned error: ${errMsg}. Trying next...`);
                    lastError = new Error(errMsg);
                    continue;
                }

                if (data._usage) {
                    addUsage('groq', data._usage);
                }
                return data.choices?.[0]?.message?.content || "El análisis falló.";
            } catch (e: any) {
                lastError = e;
                if (shouldRetryNextModel(e.message)) continue;
                throw e;
            }
        }
        throw lastError || new Error("No se pudo encontrar un modelo de Groq compatible.");
    });
};

// --- UNIFIED INTERFACE ---

export const extractTextFromDocument = async (base64Data: string, mimeType: string, provider: AIProvider = 'gemini'): Promise<string> => {
    if (provider === 'groq') {
        return extractTextWithGroq(base64Data, mimeType);
    }
    return extractTextWithGemini(base64Data, mimeType);
};

export const analyzeDocumentContent = async (text: string, base64Data?: string, mimeType?: string, provider: AIProvider = 'gemini'): Promise<string> => {
    if (provider === 'groq') {
        return analyzeWithGroq(text, base64Data, mimeType);
    }
    return analyzeWithGemini(text, base64Data, mimeType);
};
