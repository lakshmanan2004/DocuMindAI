import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import {
  Send,
  Bot,
  User,
  Sparkles,
  FileText,
  Filter,
  RotateCcw,
  ExternalLink,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { Button } from '../ui';

const Chat = () => {
  const navigate = useNavigate();
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content:
        'Hello! I am your DocuMind AI assistant. Ask me anything about your uploaded documents, invoices, marksheets, or agreements.',
      sources: []
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [documents, setDocuments] = useState([]);
  const [selectedDocId, setSelectedDocId] = useState('');
  const [expandedSources, setExpandedSources] = useState({});
  const messagesEndRef = useRef(null);

  // Auto-scroll to bottom of conversation
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  // Fetch available completed documents for optional scoping
  useEffect(() => {
    const fetchDocs = async () => {
      try {
        const res = await api.get('/chat/documents');
        setDocuments(res.data || []);
      } catch (err) {
        console.error('Failed to load documents for chat filtering:', err);
      }
    };
    fetchDocs();
  }, []);

  const handleSend = async (e) => {
    e?.preventDefault();
    if (!input.trim() || loading) return;

    const userQuestion = input.trim();
    setInput('');

    // Append user message immediately
    setMessages((prev) => [
      ...prev,
      {
        role: 'user',
        content: userQuestion,
        sources: []
      }
    ]);

    setLoading(true);

    try {
      const history = messages
        .filter(
          (m) =>
            !m.isError &&
            m.content &&
            !m.content.startsWith('Hello! I am your DocuMind') &&
            !m.content.startsWith('Conversation reset')
        )
        .slice(-6)
        .map((m) => ({ role: m.role, content: m.content }));

      const payload = {
        question: userQuestion,
        documentId: selectedDocId || undefined,
        history
      };

      const res = await api.post('/chat', payload);

      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: res.data.answer,
          sources: res.data.sources || []
        }
      ]);
    } catch (err) {
      console.error('Chat error:', err);
      const errMsg =
        err.response?.data?.message || 'Error communicating with AI engine. Please verify Ollama is running.';

      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `⚠️ ${errMsg}`,
          sources: [],
          isError: true
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const toggleSourceSnippet = (msgIdx, srcIdx) => {
    const key = `${msgIdx}-${srcIdx}`;
    setExpandedSources((prev) => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleResetChat = () => {
    setMessages([
      {
        role: 'assistant',
        content:
          'Conversation reset. Ask me anything about your uploaded documents, invoices, marksheets, or agreements.',
        sources: []
      }
    ]);
  };

  const handleSuggestedQuestion = (q) => {
    setInput(q);
  };

  return (
    <div className="max-w-5xl mx-auto flex flex-col h-[calc(100vh-7.5rem)]">
      {/* Top Header & Filters (Apple macOS Style) */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-black/[0.06] dark:border-white/[0.08]">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#1C1C1E] dark:text-[#F2F2F7] tracking-tight flex items-center gap-2">
            <div className="h-7 w-7 rounded-[8px] bg-[#007AFF]/12 text-[#007AFF] flex items-center justify-center">
              <Bot className="h-4 w-4" />
            </div>
            AI Document Chat
          </h1>
          <p className="text-xs text-[#6B7280] dark:text-[#8E8E93] mt-0.5">
            Query across your library with semantic vector search and exact grounding citations
          </p>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          {/* Document Scope Filter */}
          <div className="flex items-center gap-2 bg-white dark:bg-[#1C1C1E] border border-black/10 dark:border-white/10 rounded-[12px] px-3 py-1.5 shadow-xs text-xs w-full sm:w-auto">
            <Filter className="h-3.5 w-3.5 text-[#8E8E93]" />
            <select
              value={selectedDocId}
              onChange={(e) => setSelectedDocId(e.target.value)}
              className="bg-transparent border-none text-[#1C1C1E] dark:text-[#F2F2F7] font-medium focus:outline-none cursor-pointer text-xs"
            >
              <option value="" className="dark:bg-[#1C1C1E]">All Workspace Documents</option>
              {documents.map((doc) => (
                <option key={doc._id} value={doc._id} className="dark:bg-[#1C1C1E]">
                  {doc.originalName} ({doc.pageCount || 1} p.)
                </option>
              ))}
            </select>
          </div>

          {/* Reset Button */}
          <button
            type="button"
            onClick={handleResetChat}
            title="Reset Conversation"
            className="p-2 text-[#6B7280] dark:text-[#8E8E93] hover:text-[#1C1C1E] dark:hover:text-white bg-white dark:bg-[#1C1C1E] hover:bg-black/5 dark:hover:bg-white/10 rounded-[12px] border border-black/10 dark:border-white/10 transition-all cursor-pointer active:scale-95 shadow-xs"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto py-5 space-y-4 pr-1">
        {messages.map((msg, msgIdx) => (
          <div
            key={msgIdx}
            className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {msg.role === 'assistant' && (
              <div className="h-7 w-7 rounded-[8px] bg-[#007AFF] flex items-center justify-center text-white shrink-0 mt-0.5 shadow-xs text-xs">
                <Bot className="h-3.5 w-3.5" />
              </div>
            )}

            <div
              className={`max-w-xl px-4 py-2.5 text-xs sm:text-sm leading-relaxed shadow-xs ${
                msg.role === 'user'
                  ? 'bg-[#007AFF] text-white rounded-[18px] rounded-br-[4px]'
                  : msg.isError
                  ? 'bg-[#FF3B30]/10 border border-[#FF3B30]/20 text-[#FF3B30] rounded-[18px] rounded-bl-[4px]'
                  : 'bg-white dark:bg-[#1C1C1E] border border-black/[0.05] dark:border-white/[0.08] text-[#1C1C1E] dark:text-[#F2F2F7] rounded-[18px] rounded-bl-[4px]'
              }`}
            >
              <p className="whitespace-pre-wrap">{msg.content}</p>

              {/* Citations & Sources Chips */}
              {msg.sources && msg.sources.length > 0 && (
                <div className="mt-3 pt-2.5 border-t border-black/5 dark:border-white/10 space-y-1.5">
                  <div className="text-[10px] font-semibold text-[#8E8E93] uppercase tracking-wider flex items-center gap-1">
                    <Sparkles className="h-3 w-3 text-[#007AFF]" />
                    Cited Sources ({msg.sources.length})
                  </div>
                  <div className="space-y-1.5">
                    {msg.sources.map((src, srcIdx) => {
                      const isExpanded = !!expandedSources[`${msgIdx}-${srcIdx}`];
                      return (
                        <div
                          key={srcIdx}
                          className="bg-[#F2F2F7] dark:bg-[#2C2C2E] border border-black/5 dark:border-white/10 rounded-[10px] p-2 text-xs transition-all"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 font-medium text-[#1C1C1E] dark:text-[#F2F2F7] truncate">
                              <span className="font-bold text-[#007AFF]">[{src.citationIndex}]</span>
                              <FileText className="h-3.5 w-3.5 text-[#8E8E93] shrink-0" />
                              <span className="truncate">{src.documentName}</span>
                              <span className="text-[#8E8E93] text-[10px] shrink-0 font-normal">
                                • Page {src.pageNumber}
                              </span>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => toggleSourceSnippet(msgIdx, srcIdx)}
                                className="text-[#8E8E93] hover:text-[#1C1C1E] dark:hover:text-[#F2F2F7] p-0.5 rounded cursor-pointer"
                                title="Toggle snippet preview"
                              >
                                {isExpanded ? (
                                  <ChevronUp className="h-3.5 w-3.5" />
                                ) : (
                                  <ChevronDown className="h-3.5 w-3.5" />
                                )}
                              </button>
                              <button
                                type="button"
                                onClick={() => navigate(`/documents/${src.documentId}`)}
                                title="Open in Review"
                                className="text-[#007AFF] hover:opacity-80 p-0.5 rounded cursor-pointer"
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>

                          {isExpanded && (
                            <div className="mt-2 pt-1.5 border-t border-black/5 dark:border-white/10 text-[#1C1C1E] dark:text-[#F2F2F7] font-mono text-[11px] leading-relaxed bg-white dark:bg-black/30 p-2 rounded-[6px]">
                              "{src.snippet}"
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {msg.role === 'user' && (
              <div className="h-7 w-7 rounded-[8px] bg-black/10 dark:bg-white/15 text-[#1C1C1E] dark:text-[#F2F2F7] flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold">
                <User className="h-3.5 w-3.5" />
              </div>
            )}
          </div>
        ))}

        {/* Loading Indicator */}
        {loading && (
          <div className="flex gap-3 justify-start items-center">
            <div className="h-7 w-7 rounded-[8px] bg-[#007AFF] flex items-center justify-center text-white shrink-0 text-xs shadow-xs">
              <Bot className="h-3.5 w-3.5" />
            </div>
            <div className="bg-white dark:bg-[#1C1C1E] border border-black/5 dark:border-white/10 rounded-[18px] rounded-bl-[4px] px-3.5 py-2 text-xs text-[#8E8E93] flex items-center gap-2 shadow-xs">
              <div className="flex gap-1">
                <div className="h-1.5 w-1.5 rounded-full bg-[#007AFF] animate-bounce [animation-delay:-0.3s]" />
                <div className="h-1.5 w-1.5 rounded-full bg-[#007AFF] animate-bounce [animation-delay:-0.15s]" />
                <div className="h-1.5 w-1.5 rounded-full bg-[#007AFF] animate-bounce" />
              </div>
              <span className="text-[11px] font-medium">Searching documents...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Quick Questions */}
      {messages.length <= 2 && (
        <div className="pb-2.5 flex flex-wrap gap-2 text-xs">
          <span className="text-[#8E8E93] flex items-center gap-1 font-medium text-[11px]">
            <Sparkles className="h-3 w-3 text-[#FF9500]" /> Suggestions:
          </span>
          <button
            type="button"
            onClick={() => handleSuggestedQuestion('What is the total amount and invoice date?')}
            className="px-3 py-1 bg-white dark:bg-[#1C1C1E] hover:border-[#007AFF]/40 border border-black/5 dark:border-white/10 rounded-full text-[#1C1C1E] dark:text-[#F2F2F7] transition-all cursor-pointer active:scale-95 shadow-xs"
          >
            "What is the total amount and invoice date?"
          </button>
          <button
            type="button"
            onClick={() => handleSuggestedQuestion('What is the supplier GSTIN on the invoices?')}
            className="px-3 py-1 bg-white dark:bg-[#1C1C1E] hover:border-[#007AFF]/40 border border-black/5 dark:border-white/10 rounded-full text-[#1C1C1E] dark:text-[#F2F2F7] transition-all cursor-pointer active:scale-95 shadow-xs"
          >
            "What is the supplier GSTIN?"
          </button>
          <button
            type="button"
            onClick={() => handleSuggestedQuestion('What is the student result and total marks?')}
            className="px-3 py-1 bg-white dark:bg-[#1C1C1E] hover:border-[#007AFF]/40 border border-black/5 dark:border-white/10 rounded-full text-[#1C1C1E] dark:text-[#F2F2F7] transition-all cursor-pointer active:scale-95 shadow-xs"
          >
            "What is the student result?"
          </button>
        </div>
      )}

      {/* Input Form (Controlled Glassmorphism) */}
      <form onSubmit={handleSend} className="pt-2">
        <div className="relative flex items-center glass bg-white/80 dark:bg-[#1C1C1E]/80 backdrop-blur-md border border-black/10 dark:border-white/10 rounded-[16px] p-1 shadow-sm">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              selectedDocId
                ? 'Ask a question about the selected document...'
                : 'Ask a question across all workspace documents...'
            }
            disabled={loading}
            className="w-full bg-transparent px-3.5 py-2.5 text-xs sm:text-sm text-[#1C1C1E] dark:text-[#F2F2F7] placeholder-[#8E8E93] focus:outline-none"
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="px-3 py-2 bg-[#007AFF] hover:bg-[#0062CC] text-white text-xs font-semibold rounded-[12px] flex items-center gap-1.5 shadow-sm transition-all disabled:opacity-40 cursor-pointer active:scale-95 shrink-0 mr-1"
          >
            <span>Send</span>
            <Send className="h-3.5 w-3.5" />
          </button>
        </div>
      </form>
    </div>
  );
};

export default Chat;
