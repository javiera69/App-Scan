import { GoogleGenAI } from "@google/genai";

export type AIProvider = 'gemini' | 'groq';

const getApiKey = (provider: AIProvider): string => {
    const manualKey = localStorage.getItem(`manual_${provider}_api_key`);
    if (manualKey && manualKey.trim() !== '') {
        return manualKey.trim();
    }

    if (provider === 'gemini') {
        // @ts-ignore
        const apiKey: string = (typeof __GEMINI_API_KEY__ !== 'undefined' ? __GEMINI_API_KEY__ : '') ||
            // @ts-ignore
            (import.meta.env.VITE_GEMINI_API_KEY) || '';
        if (!apiKey || apiKey === 'undefined' || apiKey.trim() === '') {
            throw new Error("Clave API de Gemini no encontrada.");
        }
        return apiKey.trim();
    } else {
        // @ts-ignore
        const apiKey: string = (typeof __GROQ_API_KEY__ !== 'undefined' ? __GROQ_API_KEY__ : '') ||
            // @ts-ignore
            (import.meta.env.VITE_GROQ_API_KEY) || '';
        if (!apiKey || apiKey === 'undefined' || apiKey.trim() === '') {
            throw new Error("Clave API de Groq no encontrada.");
        }
        return apiKey.trim();
    }
};

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function callWithRetry<T>(fn: () => Promise<T>, maxRetries = 3, initialDelay = 2000): Promise<T> {
    let lastError: any;
    for (let i = 0; i <= maxRetries; i++) {
        try {
            return await fn();
        } catch (error: any) {
            lastError = error;
            const isRateLimit = error?.message?.includes('429') || error?.status === 429 || error?.code === 429 || error?.message?.includes('rate_limit');

            if (isRateLimit && i < maxRetries) {
                const waitTime = initialDelay * Math.pow(2, i);
                console.warn(`Rate Limit (429). Retrying in ${waitTime}ms... (Attempt ${i + 1}/${maxRetries})`);
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
    const apiKey = getApiKey('gemini');
    const ai = new GoogleGenAI({ apiKey });

    return callWithRetry(async () => {
        const response = await ai.models.generateContent({
            model: 'gemini-2.0-flash',
            contents: [
                {
                    role: 'user',
                    parts: [
                        { inlineData: { mimeType: mimeType, data: base64Data } },
                        { text: "Transcribe el texto de este documento exactamente como aparece. Mantén la estructura (listas, encabezados) usando Markdown. No incluyas ningún texto de introducción o cierre." }
                    ]
                }
            ]
        });
        return response.text || "No se pudo extraer ningún texto.";
    });
};

const analyzeWithGemini = async (text: string, base64Data?: string, mimeType?: string): Promise<string> => {
    const apiKey = getApiKey('gemini');
    const ai = new GoogleGenAI({ apiKey });

    return callWithRetry(async () => {
        const parts: any[] = [
            { text: `Analiza el contenido de este documento:\n\n${text}\n\nProporciona un resumen estructurado que incluya:\n1. Tipo de Documento\n2. Fechas Clave\n3. Entidades Principales (Personas/Empresas)\n4. Tareas Pendientes o Resumen` }
        ];

        if (base64Data && mimeType) {
            parts.unshift({ inlineData: { mimeType: mimeType, data: base64Data } });
        }

        const response = await ai.models.generateContent({
            model: 'gemini-2.0-flash',
            contents: [
                {
                    role: 'user',
                    parts: parts
                }
            ]
        });

        return response.text || "El análisis falló.";
    });
};

// --- GROQ IMPLEMENTATION ---

const extractTextWithGroq = async (base64Data: string, mimeType: string): Promise<string> => {
    const apiKey = getApiKey('groq');

    return callWithRetry(async () => {
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'llama-3.2-90b-vision-preview',
                messages: [
                    {
                        role: 'user',
                        content: [
                            { type: 'text', text: "Transcribe el texto de este documento exactamente como aparece. Mantén la estructura (listas, encabezados) usando Markdown. No incluyas ningún texto de introducción o cierre." },
                            { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64Data}` } }
                        ]
                    }
                ],
                temperature: 0.1,
                max_tokens: 4096
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || 'Error en Groq API');
        }

        const data = await response.json();
        return data.choices[0]?.message?.content || "No se pudo extraer ningún texto.";
    });
};

const analyzeWithGroq = async (text: string, base64Data?: string, mimeType?: string): Promise<string> => {
    const apiKey = getApiKey('groq');

    return callWithRetry(async () => {
        const content: any[] = [
            { type: 'text', text: `Analiza el contenido de este documento:\n\n${text}\n\nProporciona un resumen estructurado que incluya:\n1. Tipo de Documento\n2. Fechas Clave\n3. Entidades Principales (Personas/Empresas)\n4. Tareas Pendientes o Resumen` }
        ];

        if (base64Data && mimeType) {
            content.push({ type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64Data}` } });
        }

        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'llama-3.2-90b-vision-preview',
                messages: [{ role: 'user', content }],
                temperature: 0.1,
                max_tokens: 4096
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || 'Error en Groq API');
        }

        const data = await response.json();
        return data.choices[0]?.message?.content || "El análisis falló.";
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
