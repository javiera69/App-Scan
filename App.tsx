import React, { useState, useEffect, useRef } from 'react';
import { extractTextFromDocument, analyzeDocumentContent, AIProvider } from './services/aiService';
import { Camera, FileText, Upload, Loader2, Sparkles, BrainCircuit, Copy, Share, ArrowLeft, Download, Cloud, ChevronRight, Plus, Clock, Settings, X, Check, AlertCircle } from 'lucide-react';
import TokenDisplay from './components/TokenDisplay';

// --- HELPERS ---

const fileToBase64 = (file: File): Promise<string> => {
    return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            let encoded = reader.result?.toString().replace(/^data:(.*,)?/, '');
            if ((encoded?.length || 0) % 4 > 0) {
                encoded += '='.repeat(4 - (encoded?.length || 0) % 4);
            }
            resolve(encoded || '');
        };
        reader.onerror = error => reject(error);
    });
};

// --- COMPONENTS ---

const Scanner = ({ onFileSelected }) => {
    const fileInputRef = useRef(null);

    const handleFileChange = (e) => {
        if (e.target.files && e.target.files.length > 0) {
            onFileSelected(e.target.files[0]);
        }
    };

    const triggerCamera = () => {
        fileInputRef.current?.setAttribute("capture", "environment");
        fileInputRef.current?.click();
    };

    const triggerUpload = () => {
        fileInputRef.current?.removeAttribute("capture");
        fileInputRef.current?.click();
    };

    return (
        <div className="flex flex-col items-center justify-center h-full p-6 space-y-8 animate-fade-in-up">
            <div className="text-center space-y-2">
                <div className="w-20 h-20 bg-blue-100 text-blue-600 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-sm">
                    <FileText size={40} />
                </div>
                <h2 className="text-2xl font-bold text-slate-800">Escanear Documento</h2>
                <p className="text-slate-500 max-w-xs mx-auto">
                    Captura una foto o sube un PDF para extraer texto y analizar el contenido.
                </p>
            </div>

            <div className="w-full max-w-sm space-y-4">
                <button
                    onClick={triggerCamera}
                    className="w-full bg-blue-600 hover:bg-blue-700 active:scale-95 transition-all text-white font-semibold py-4 px-6 rounded-2xl flex items-center justify-center gap-3 shadow-lg shadow-blue-200"
                >
                    <Camera size={24} />
                    <span>Usar Cámara</span>
                </button>

                <button
                    onClick={triggerUpload}
                    className="w-full bg-white hover:bg-slate-50 active:scale-95 transition-all text-slate-700 font-semibold py-4 px-6 rounded-2xl flex items-center justify-center gap-3 shadow-md border border-slate-100"
                >
                    <Upload size={24} />
                    <span>Subir Archivo</span>
                </button>
            </div>

            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/*,application/pdf"
                className="hidden"
            />
        </div>
    );
};

const ProcessingView = ({ state }) => {
    return (
        <div className="flex flex-col items-center justify-center h-full p-8 text-center space-y-8 animate-pulse-slow">
            <div className="relative">
                <div className="absolute inset-0 bg-blue-400 opacity-20 blur-2xl rounded-full animate-pulse"></div>
                <div className="relative bg-white w-24 h-24 rounded-3xl shadow-xl flex items-center justify-center">
                    {state.status === 'thinking' ? (
                        <BrainCircuit className="text-purple-600 animate-pulse" size={48} />
                    ) : (
                        <Sparkles className="text-blue-600 animate-spin-slow" size={48} />
                    )}
                </div>
            </div>

            <div className="space-y-3">
                <h3 className="text-xl font-semibold text-slate-800">
                    {state.status === 'thinking' ? 'Análisis Profundo...' : 'Procesando Documento...'}
                </h3>
                <p className="text-slate-500 text-sm max-w-xs mx-auto">
                    {state.message}
                </p>
            </div>

            {state.status === 'thinking' && (
                <div className="px-4 py-2 bg-purple-50 text-purple-700 text-xs font-medium rounded-full border border-purple-100 flex items-center gap-2">
                    <Loader2 size={12} className="animate-spin" />
                    Presupuesto de Pensamiento Activo
                </div>
            )}
        </div>
    );
};

const SettingsModal = ({ isOpen, onClose }) => {
    const [geminiKey, setGeminiKey] = useState(localStorage.getItem('manual_gemini_api_key') || '');
    const [groqKey, setGroqKey] = useState(localStorage.getItem('manual_groq_api_key') || '');
    const [saved, setSaved] = useState(false);

    if (!isOpen) return null;

    const handleSave = () => {
        localStorage.setItem('manual_gemini_api_key', geminiKey.trim());
        localStorage.setItem('manual_groq_api_key', groqKey.trim());
        setSaved(true);
        setTimeout(() => {
            setSaved(false);
            onClose();
            window.location.reload(); // Reload to apply changes
        }, 1500);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden animate-scale-in">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2">
                        <Settings size={18} className="text-slate-400" />
                        Configuración de API
                    </h3>
                    <button onClick={onClose} className="p-2 -mr-2 text-slate-400 hover:text-slate-600">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Gemini API Key</label>
                        <input
                            type="password"
                            value={geminiKey}
                            onChange={(e) => setGeminiKey(e.target.value)}
                            placeholder="Pega tu clave de Gemini aquí..."
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                        />
                        <p className="text-[10px] text-slate-400">Si se deja vacío, se usará la clave por defecto del sistema.</p>
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Groq API Key</label>
                        <input
                            type="password"
                            value={groqKey}
                            onChange={(e) => setGroqKey(e.target.value)}
                            placeholder="Pega tu clave de Groq aquí..."
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
                        />
                        <p className="text-[10px] text-slate-400">Necesaria para usar el modelo Llama 3.2 Vision.</p>
                    </div>

                    <div className="bg-blue-50 p-4 rounded-2xl flex gap-3">
                        <AlertCircle className="text-blue-500 shrink-0" size={18} />
                        <p className="text-xs text-blue-700 leading-relaxed">
                            Las claves se guardan localmente en tu navegador y nunca se envían a nuestros servidores.
                        </p>
                    </div>

                    <button
                        onClick={handleSave}
                        disabled={saved}
                        className={`w-full py-4 rounded-2xl font-bold transition-all flex items-center justify-center gap-2 ${saved ? 'bg-green-500 text-white' : 'bg-slate-900 text-white hover:bg-slate-800 active:scale-95'
                            }`}
                    >
                        {saved ? <><Check size={20} /> Guardado</> : 'Guardar Configuración'}
                    </button>
                </div>
            </div>
        </div>
    );
};

const ResultView = ({ doc, onBack, onAnalyze, isAnalyzing }) => {
    const [activeTab, setActiveTab] = useState('text');
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        const textToCopy = activeTab === 'text' ? doc.textData : (doc.analysis || '');
        navigator.clipboard.writeText(textToCopy);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleDownload = () => {
        const element = document.createElement("a");
        const file = new Blob([doc.textData], { type: 'text/plain' });
        element.href = URL.createObjectURL(file);
        element.download = `documind-${doc.title}.txt`;
        document.body.appendChild(element);
        element.click();
        document.body.removeChild(element);
    };

    const handleSaveToDrive = async () => {
        const fileName = `documind-${doc.id}.txt`;
        const file = new File([doc.textData], fileName, { type: 'text/plain' });

        // @ts-ignore
        if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
            try {
                await navigator.share({
                    files: [file],
                    title: doc.title,
                    text: 'Documento escaneado de DocuMind',
                });
                return;
            } catch (err) {
                console.log('Share dismissed', err);
            }
        } else {
            handleDownload();
        }
    };

    const handleShare = async () => {
        if (navigator.share) {
            try {
                await navigator.share({
                    title: doc.title,
                    text: activeTab === 'text' ? doc.textData : doc.analysis,
                });
            } catch (err) {
                console.log('Share canceled');
            }
        } else {
            handleCopy();
        }
    };

    return (
        <div className="flex flex-col h-full bg-slate-50">
            {/* Header */}
            <div className="bg-white/80 backdrop-blur-md sticky top-0 z-10 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                <button onClick={onBack} className="p-2 -ml-2 text-slate-600 hover:text-slate-900">
                    <ArrowLeft size={24} />
                </button>
                <h1 className="font-semibold text-slate-800 truncate max-w-[200px]">{doc.title}</h1>
                <button onClick={handleShare} className="p-2 -mr-2 text-blue-600 font-medium">
                    Compartir
                </button>
            </div>

            {/* Tabs */}
            <div className="p-4 pb-0">
                <div className="flex bg-slate-200/50 p-1 rounded-xl">
                    <button
                        onClick={() => setActiveTab('text')}
                        className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-lg transition-all ${activeTab === 'text' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                            }`}
                    >
                        <FileText size={16} />
                        Texto Original
                    </button>
                    <button
                        onClick={() => {
                            setActiveTab('analysis');
                            if (!doc.analysis) onAnalyze();
                        }}
                        className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-lg transition-all ${activeTab === 'analysis' ? 'bg-white text-purple-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                            }`}
                    >
                        {isAnalyzing ? <Sparkles size={16} className="animate-spin" /> : <Sparkles size={16} />}
                        Análisis IA
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4">
                <div className="bg-white rounded-2xl shadow-sm p-5 min-h-[300px] text-slate-700 whitespace-pre-wrap leading-relaxed border border-slate-100 select-text">
                    {activeTab === 'text' ? (
                        doc.textData
                    ) : (
                        isAnalyzing ? (
                            <div className="flex flex-col items-center justify-center h-48 text-purple-600 space-y-3">
                                <Sparkles className="animate-spin" size={32} />
                                <p className="text-sm font-medium">Analizando con IA...</p>
                                <p className="text-xs text-purple-400">Presupuesto de pensamiento: 32k tokens</p>
                            </div>
                        ) : (
                            doc.analysis || (
                                <div className="text-center text-slate-400 py-10">
                                    <p>Toca "Análisis IA" para resumir y extraer información.</p>
                                </div>
                            )
                        )
                    )}
                </div>
            </div>

            {/* Actions Toolbar */}
            <div className="bg-white border-t border-slate-200 px-4 py-4 safe-area-bottom">
                <div className="grid grid-cols-2 gap-3">
                    <button
                        onClick={handleCopy}
                        className="flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 font-semibold py-3 rounded-xl transition-colors"
                    >
                        {copied ? <span className="text-green-600">¡Copiado!</span> : <><Copy size={18} /> Copiar Texto</>}
                    </button>
                    <button
                        onClick={handleSaveToDrive}
                        className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold py-3 rounded-xl transition-colors shadow-blue-200 shadow-lg"
                    >
                        <Cloud size={18} />
                        Guardar en Drive
                    </button>
                </div>
                <p className="text-center text-xs text-slate-400 mt-3">
                    Abre el menú de compartir. Selecciona "Drive" o "Guardar en Archivos".
                </p>
            </div>
        </div>
    );
};

// --- MAIN APP ---

const App = () => {
    const [view, setView] = useState('HOME');
    const [processing, setProcessing] = useState({ status: 'idle' });
    const [documents, setDocuments] = useState([]);
    const [currentDoc, setCurrentDoc] = useState(null);
    const [rawFile, setRawFile] = useState(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [provider, setProvider] = useState<AIProvider>('gemini');
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [hasKeys, setHasKeys] = useState({ gemini: true, groq: true });

    useEffect(() => {
        const checkKeys = () => {
            const gKey = localStorage.getItem('manual_gemini_api_key') ||
                // @ts-ignore
                (typeof __GEMINI_API_KEY__ !== 'undefined' ? __GEMINI_API_KEY__ : '') || '';
            const grKey = localStorage.getItem('manual_groq_api_key') ||
                // @ts-ignore
                (typeof __GROQ_API_KEY__ !== 'undefined' ? __GROQ_API_KEY__ : '') || '';

            setHasKeys({
                gemini: gKey.trim() !== '' && gKey !== 'undefined',
                groq: grKey.trim() !== '' && grKey !== 'undefined'
            });
        };
        checkKeys();
    }, [isSettingsOpen]);

    useEffect(() => {
        const saved = localStorage.getItem('documind_scans');
        if (saved) {
            try {
                setDocuments(JSON.parse(saved));
            } catch (e) {
                console.error("Failed to load history", e);
            }
        }
    }, []);

    useEffect(() => {
        localStorage.setItem('documind_scans', JSON.stringify(documents));
    }, [documents]);

    const handleFileSelected = async (file) => {
        setView('PROCESSING');
        setProcessing({ status: 'uploading', message: 'Leyendo archivo...' });

        try {
            const base64Data = await fileToBase64(file);
            setRawFile({ data: base64Data, mimeType: file.type });

            setProcessing({ status: 'ocr', message: `Extrayendo texto con ${provider === 'gemini' ? 'Gemini' : 'Llama (Groq)'}...` });
            const text = await extractTextFromDocument(base64Data, file.type, provider);

            const newDoc = {
                id: Date.now().toString(),
                timestamp: Date.now(),
                title: `Escaneo ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
                textData: text,
                type: file.type.includes('pdf') ? 'pdf' : 'image',
            };

            setCurrentDoc(newDoc);
            setDocuments(prev => [newDoc, ...prev]);
            setProcessing({ status: 'complete' });
            setView('RESULT');

        } catch (error: any) {
            console.error(error);
            const isRateLimit = error?.message?.includes('429') || error?.status === 429 || error?.code === 429;
            const errorMessage = isRateLimit
                ? "Límite de cuota excedido. Por favor, espera un momento y vuelve a intentarlo."
                : `Error al procesar el documento: ${error.message || JSON.stringify(error)}. Por favor, inténtalo de nuevo.`;

            setProcessing({
                status: 'error',
                message: errorMessage
            });
            setTimeout(() => setView('HOME'), 10000);
        }
    };

    const performAnalysis = async () => {
        if (!currentDoc) return;

        try {
            const analysis = await analyzeDocumentContent(
                currentDoc.textData,
                rawFile?.data,
                rawFile?.mimeType,
                provider
            );

            const updatedDoc = { ...currentDoc, analysis };
            setCurrentDoc(updatedDoc);
            setDocuments(prev => prev.map(d => d.id === updatedDoc.id ? updatedDoc : d));
        } catch (error: any) {
            console.error(error);
            const isRateLimit = error?.message?.includes('429') || error?.status === 429 || error?.code === 429;
            const errorMessage = isRateLimit
                ? "Límite de cuota excedido. Por favor, espera un momento y vuelve a intentarlo."
                : `El análisis falló: ${error.message || "Error desconocido"}. Por favor, comprueba tu conexión o clave API.`;
            alert(errorMessage);
        }
    };

    const onAnalyzeRequest = async () => {
        setIsAnalyzing(true);
        await performAnalysis();
        setIsAnalyzing(false);
    };

    const renderHome = () => (
        <div className="flex flex-col h-full bg-slate-50">
            <header className="px-6 pt-12 pb-6 bg-white border-b border-slate-200">
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-200">
                            <FileText size={20} />
                        </div>
                        <h1 className="text-2xl font-bold text-slate-800 tracking-tight">DocuMind</h1>
                    </div>
                    <button
                        onClick={() => setIsSettingsOpen(true)}
                        className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
                    >
                        <Settings size={24} />
                    </button>
                </div>
                <p className="text-slate-500 text-sm font-medium">Escáner de Documentos con IA</p>

                <div className="mt-6 flex bg-slate-100 p-1 rounded-xl">
                    <button
                        onClick={() => setProvider('gemini')}
                        className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${provider === 'gemini' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}
                    >
                        Gemini 2.5
                        {!hasKeys.gemini && <AlertCircle size={12} className="text-red-500" />}
                    </button>
                    <button
                        onClick={() => setProvider('groq')}
                        className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${provider === 'groq' ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-400'}`}
                    >
                        Groq (Llama 3.2)
                        {!hasKeys.groq && <AlertCircle size={12} className="text-red-500" />}
                    </button>
                </div>

                    {!hasKeys[provider] && (
                    <button
                        onClick={() => setIsSettingsOpen(true)}
                        className="mt-4 w-full bg-red-50 border border-red-100 text-red-600 py-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 animate-pulse"
                    >
                        <AlertCircle size={16} />
                        Falta Clave API para {provider === 'gemini' ? 'Gemini' : 'Groq'}. Configurar ahora.
                    </button>
                )}

                <TokenDisplay />
            </header>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                <div className="flex items-center justify-between px-2">
                    <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                        <Clock size={18} className="text-slate-400" />
                        Escaneos Recientes
                    </h2>
                </div>

                {documents.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center space-y-4 opacity-60">
                        <div className="w-16 h-16 bg-slate-200 rounded-full flex items-center justify-center">
                            <FileText size={32} className="text-slate-400" />
                        </div>
                        <p className="text-slate-500">Aún no hay documentos escaneados.</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {documents.map(doc => (
                            <button
                                key={doc.id}
                                onClick={() => {
                                    setCurrentDoc(doc);
                                    setRawFile(null);
                                    setView('RESULT');
                                }}
                                className="w-full bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4 hover:bg-slate-50 transition-colors text-left group"
                            >
                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${doc.type === 'pdf' ? 'bg-red-50 text-red-500' : 'bg-blue-50 text-blue-500'}`}>
                                    <FileText size={24} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h3 className="font-semibold text-slate-800 truncate">{doc.title}</h3>
                                    <p className="text-xs text-slate-500 truncate mt-1">
                                        {doc.textData.substring(0, 40)}...
                                    </p>
                                </div>
                                <ChevronRight className="text-slate-300 group-hover:text-slate-400" size={20} />
                            </button>
                        ))}
                    </div>
                )}
            </div>

            <div className="p-4 pb-8 bg-white border-t border-slate-200">
                <button
                    onClick={() => setView('SCANNING')}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-2xl shadow-xl shadow-blue-200 flex items-center justify-center gap-2 transition-transform active:scale-95"
                >
                    <Plus size={24} strokeWidth={3} />
                    <span>Escanear Nuevo Documento</span>
                </button>
                <p className="text-[10px] text-slate-300 text-center mt-4">
                    Versión: 1.0.15 - {new Date().toLocaleString()}
                </p>
            </div>
        </div>
    );

    return (
        <div className="max-w-md mx-auto h-screen bg-white shadow-2xl overflow-hidden relative">
            {view === 'HOME' && renderHome()}

            {view === 'SCANNING' && (
                <div className="h-full flex flex-col">
                    <header className="px-4 py-3 bg-white border-b border-slate-100 flex items-center">
                        <button onClick={() => setView('HOME')} className="p-2 -ml-2 text-slate-600 hover:text-slate-900">
                            <ArrowLeft size={24} />
                        </button>
                        <span className="font-semibold ml-2">Nuevo Escaneo</span>
                    </header>
                    <div className="flex-1">
                        <Scanner onFileSelected={handleFileSelected} />
                    </div>
                </div>
            )}

            {view === 'PROCESSING' && <ProcessingView state={processing} />}

            {view === 'RESULT' && currentDoc && (
                <ResultView
                    doc={currentDoc}
                    onBack={() => setView('HOME')}
                    onAnalyze={onAnalyzeRequest}
                    isAnalyzing={isAnalyzing}
                />
            )}

            <SettingsModal
                isOpen={isSettingsOpen}
                onClose={() => setIsSettingsOpen(false)}
            />
        </div>
    );
};

export default App;
