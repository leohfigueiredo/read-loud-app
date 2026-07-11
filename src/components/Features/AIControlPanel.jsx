import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, MessageSquare, BookOpen, RefreshCw, Loader2, ChevronLeft, Copy, CheckCircle2, Send } from 'lucide-react';
import { generateCatchMeUp } from '../../services/gemini';

export default function AIControlPanel({ _bookData, currentPageText, onClose }) {
  const [loading, setLoading] = useState(false);
  const [aiResponse, setAiResponse] = useState("");
  const [mode, setMode] = useState('menu'); // 'menu', 'summary', 'explain', 'chat'
  const [copied, setCopied] = useState(false);
  
  // Chat state
  const [chatInput, setChatInput] = useState("");
  const [chatHistory, setChatHistory] = useState([]);
  const chatEndRef = useRef(null);

  useEffect(() => {
    scrollToBottom();
  }, [chatHistory]);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleSummary = async () => {
    setLoading(true);
    try {
      const summary = await generateCatchMeUp(currentPageText);
      setAiResponse(summary);
      setMode('summary');
    } catch (error) {
      console.error('Summary generation failed:', error);
      setAiResponse("Erro ao gerar resumo. Verifique sua chave de API.");
    } finally {
      setLoading(false);
    }
  };

  const _handleExplain = async () => {
    setLoading(true);
    try {
      const explanation = await generateCatchMeUp(`Explique este trecho de forma simples: ${currentPageText}`);
      setAiResponse(explanation);
      setMode('explain');
    } catch (error) {
      console.error('Explanation generation failed:', error);
      setAiResponse("Erro ao explicar.");
    } finally {
      setLoading(false);
    }
  };

  const handleChatSubmit = async () => {
    if (!chatInput.trim() || loading) return;

    const userMessage = chatInput.trim();
    setChatHistory(prev => [...prev, { role: 'user', content: userMessage }]);
    setChatInput("");
    setLoading(true);

    try {
      const simulatedResponse = await generateCatchMeUp(`Responda a esta pergunta baseada no texto: ${userMessage}. Texto: ${currentPageText}`);
      setChatHistory(prev => [...prev, { role: 'ai', content: simulatedResponse }]);
    } catch (error) {
      console.error('Chat error:', error);
      setChatHistory(prev => [...prev, { role: 'ai', content: "Erro ao processar pergunta." }]);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(aiResponse);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="ai-control-panel glass-panel">
      <div className="ai-header">
        <Sparkles size={20} className="text-accent" />
        <h3>Assistente de IA</h3>
        <button className="close-btn" onClick={onClose}>&times;</button>
      </div>

      {mode === 'menu' ? (
        <div className="ai-menu">
          <button className="ai-option-btn" onClick={handleSummary} disabled={loading}>
            <BookOpen size={20} />
            <span>Resumo do Contexto</span>
          </button>
          <button className="ai-option-btn" onClick={() => setMode('chat')} disabled={loading}>
            <MessageSquare size={20} />
            <span>Perguntar sobre o texto</span>
          </button>
        </div>
      ) : mode === 'chat' ? (
        <div className="ai-chat-container">
          <div className="chat-messages">
            {chatHistory.map((msg, idx) => (
              <div key={idx} className={`chat-message ${msg.role}`}>
                <div className="message-bubble">{msg.content}</div>
              </div>
            ))}
            {loading && (
              <div className="chat-message ai">
                <div className="message-bubble loading-dots">
                  <span></span><span></span><span></span>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
          <div className="chat-input-area">
            <input 
              type="text" 
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleChatSubmit()}
              placeholder="Sua pergunta..."
              disabled={loading}
            />
            <button onClick={handleChatSubmit} disabled={!chatInput.trim() || loading}>
              <Send size={20} />
            </button>
          </div>
        </div>
      ) : (
        <div className="ai-response-area">
          {loading ? (
            <div className="ai-loading">
              <Loader2 className="spin" size={32} />
              <p>Pensando...</p>
            </div>
          ) : (
            <>
              <div className="ai-text-content">{aiResponse}</div>
              <div className="ai-actions">
                <button onClick={() => setMode('menu')} className="secondary-btn">
                  <ChevronLeft size={16} /> Voltar
                </button>
                {mode === 'summary' && (
                  <button onClick={handleSummary} className="secondary-btn" title="Atualizar">
                    <RefreshCw size={16}/>
                  </button>
                )}
                <button onClick={copyToClipboard} className="secondary-btn" title="Copiar texto">
                  {copied ? <CheckCircle2 size={16} className="text-success" /> : <Copy size={16} />}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}