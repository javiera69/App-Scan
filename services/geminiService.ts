import { GoogleGenAI } from "@google/genai";

const getApiKey = (): string => {
    // @ts-ignore
    const apiKey: string = (typeof __GEMINI_API_KEY__ !== 'undefined' ? __GEMINI_API_KEY__ : '') ||
        // @ts-ignore
        (import.meta.env.VITE_GEMINI_API_KEY) || '';

    if (!apiKey || apiKey === 'undefined' || apiKey.trim() === '') {
        throw new Error("Clave API no encontrada. Verifica los Secrets de GitHub (GEMINI_API_KEY).");
    }
    return apiKey.trim();
};

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function callGeminiWithRetry<T>(fn: () => Promise<T>, maxRetries = 3, initialDelay = 2000): Promise<T> {
    let lastError: any;
    for (let i = 0; i <= maxRetries; i++) {
        try {
            return await fn();
        } catch (error: any) {
            lastError = error;
            const isRateLimit = error?.message?.includes('429') || error?.status === 429 || error?.code === 429;

            if (isRateLimit && i < maxRetries) {
                const waitTime = initialDelay * Math.pow(2, i);
                console.warn(`Gemini Rate Limit (429). Retrying in ${waitTime}ms... (Attempt ${i + 1}/${maxRetries})`);
                await delay(waitTime);
                continue;
            }
            throw error;
        }
    }
    throw lastError;
}

export const extractTextFromDocument = async (base64Data: string, mimeType: string): Promise<string> => {
    const apiKey = getApiKey();
    const ai = new GoogleGenAI({ apiKey });

    return callGeminiWithRetry(async () => {
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

export const analyzeDocumentContent = async (text: string, base64Data?: string, mimeType?: string): Promise<string> => {
    const apiKey = getApiKey();
    const ai = new GoogleGenAI({ apiKey });

    return callGeminiWithRetry(async () => {
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
