import React, { useState, useEffect } from 'react';
import { getTokenUsage, resetTokenUsage, TokenUsageData } from '../services/aiService';
import { RefreshCw, Zap, ChevronDown, ChevronUp } from 'lucide-react';

const TokenDisplay = () => {
    const [usage, setUsage] = useState<TokenUsageData | null>(null);
    const [isExpanded, setIsExpanded] = useState(false);

    useEffect(() => {
        setUsage(getTokenUsage());
    }, []);

    const handleReset = () => {
        if (confirm('¿Reiniciar el contador de tokens?')) {
            resetTokenUsage();
            setUsage(getTokenUsage());
        }
    };

    if (!usage) return null;

    const totalUsed = usage.gemini.totalTokens + usage.groq.totalTokens;

    return (
        <div className="bg-slate-800 text-white rounded-xl p-3 mt-4">
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full flex items-center justify-between"
            >
                <div className="flex items-center gap-2">
                    <Zap size={16} className="text-yellow-400" />
                    <span className="text-sm font-medium">Tokens usados: {totalUsed.toLocaleString()}</span>
                </div>
                {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </button>

            {isExpanded && (
                <div className="mt-3 pt-3 border-t border-slate-700 space-y-2">
                    <div className="flex justify-between text-xs">
                        <span className="text-blue-400">Gemini</span>
                        <span>{usage.gemini.totalTokens.toLocaleString()} tokens</span>
                    </div>
                    <div className="flex justify-between text-xs">
                        <span className="text-orange-400">Groq</span>
                        <span>{usage.groq.totalTokens.toLocaleString()} tokens</span>
                    </div>
                    
                    <div className="pt-2 mt-2 border-t border-slate-700">
                        <div className="flex justify-between text-xs text-slate-400">
                            <span>Prompt</span>
                            <span>{(usage.gemini.promptTokens + usage.groq.promptTokens).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-xs text-slate-400">
                            <span>Completion</span>
                            <span>{(usage.gemini.completionTokens + usage.groq.completionTokens).toLocaleString()}</span>
                        </div>
                    </div>

                    <button
                        onClick={handleReset}
                        className="mt-2 w-full flex items-center justify-center gap-2 text-xs bg-slate-700 hover:bg-slate-600 py-2 rounded-lg transition-colors"
                    >
                        <RefreshCw size={14} />
                        Reiniciar contador
                    </button>
                </div>
            )}
        </div>
    );
};

export default TokenDisplay;