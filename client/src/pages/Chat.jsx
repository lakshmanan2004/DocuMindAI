import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import {
  Send,
  Bot,
  User,
  FileText,
  Filter,
  Sparkles,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  AlertCircle
} from 'lucide-react';

const Chat = () => {
  const navigate = useNavigate();
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content:
        'Hello! I am your DocuMind AI assistant. Ask me anything about your uploaded documents, invoices, or agreements.',
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

  // Fetch available documents for the filter dropdown
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
          'Conversation reset. Ask me anything about your uploaded documents, invoices, or agreements.',
        sources: []
      }
    ]);
  };

  const handleSuggestedQuestion = (q) => {
    setInput(q);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 flex flex-col h-[calc(100vh-5rem)]">
      {/* Top Header & Filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Bot className="h-6 w-6 text-indigo-600" />
            AI Document Chat
          </h1>
          <p className="text-xs text-slate-500">
            Ask questions with semantic vector search and exact document citations
          </p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          {/* Document Scope Filter */}
          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-1.5 shadow-sm text-xs w-full sm:w-auto">
            <Filter className="h-3.5 w-3.5 text-slate-400" />
            <select
              value={selectedDocId}
              onChange={(e) => setSelectedDocId(e.target.value)}
              className="bg-transparent border-none text-slate-700 font-medium focus:outline-none cursor-pointer text-xs"
            >
              <option value="">All Organization Documents</option>
              {documents.map((doc) => (
                <option key={doc._id} value={doc._id}>
                  {doc.originalName} ({doc.pageCount || 1} p.)
                </option>
              ))}
            </select>
          </div>

          {/* Reset Button */}
          <button
            onClick={handleResetChat}
            title="Reset Conversation"
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto py-6 space-y-5 pr-2">
        {messages.map((msg, msgIdx) => (
          <div
            key={msgIdx}
            className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {msg.role === 'assistant' && (
              <div className="h-8 w-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white shrink-0 mt-0.5 shadow-sm">
                <Bot className="h-4 w-4" />
              </div>
            )}

            <div
              className={`max-w-2xl rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${
                msg.role === 'user'
                  ? 'bg-indigo-600 text-white rounded-br-none'
                  : msg.isError
                  ? 'bg-rose-50 border border-rose-200 text-rose-800 rounded-bl-none'
                  : 'bg-white border border-slate-200 text-slate-800 rounded-bl-none'
              }`}
            >
              <p className="whitespace-pre-wrap">{msg.content}</p>

              {/* Citations & Sources Chips */}
              {msg.sources && msg.sources.length > 0 && (
                <div className="mt-3 pt-3 border-t border-slate-100">
                  <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                    <Sparkles className="h-3 w-3 text-indigo-500" />
                    Cited Sources ({msg.sources.length})
                  </div>
                  <div className="space-y-2">
                    {msg.sources.map((src, srcIdx) => {
                      const isExpanded = !!expandedSources[`${msgIdx}-${srcIdx}`];
                      return (
                        <div
                          key={srcIdx}
                          className="bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs transition-all"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 font-medium text-slate-800 truncate">
                              <span className="font-bold text-indigo-600">[{src.citationIndex}]</span>
                              <FileText className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                              <span className="truncate">{src.documentName}</span>
                              <span className="text-slate-400 text-[10px] shrink-0 font-normal">
                                • Page {src.pageNumber}
                              </span>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                onClick={() => toggleSourceSnippet(msgIdx, srcIdx)}
                                className="text-slate-400 hover:text-slate-700 p-0.5 rounded"
                                title="Toggle snippet preview"
                              >
                                {isExpanded ? (
                                  <ChevronUp className="h-3.5 w-3.5" />
                                ) : (
                                  <ChevronDown className="h-3.5 w-3.5" />
                                )}
                              </button>
                              <button
                                onClick={() => navigate(`/review/${src.documentId}`)}
                                title="Open in Review"
                                className="text-indigo-600 hover:text-indigo-800 p-0.5 rounded"
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>

                          {isExpanded && (
                            <div className="mt-2 pt-2 border-t border-slate-200 text-slate-600 font-mono text-[11px] leading-relaxed bg-white p-2 rounded border border-slate-100">
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
              <div className="h-8 w-8 rounded-lg bg-slate-800 flex items-center justify-center text-white shrink-0 mt-0.5 shadow-sm">
                <User className="h-4 w-4" />
              </div>
            )}
          </div>
        ))}

        {/* Loading Thinking Indicator */}
        {loading && (
          <div className="flex gap-3 justify-start">
            <div className="h-8 w-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white shrink-0 mt-0.5 shadow-sm animate-pulse">
              <Bot className="h-4 w-4" />
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-none px-4 py-3 text-sm text-slate-500 flex items-center gap-2 shadow-sm">
              <div className="flex gap-1">
                <div className="h-2 w-2 rounded-full bg-indigo-500 animate-bounce [animation-delay:-0.3s]" />
                <div className="h-2 w-2 rounded-full bg-indigo-500 animate-bounce [animation-delay:-0.15s]" />
                <div className="h-2 w-2 rounded-full bg-indigo-500 animate-bounce" />
              </div>
              <span className="text-xs font-medium text-slate-500">Searching document vectors...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Quick Questions (When conversation is fresh) */}
      {messages.length <= 2 && (
        <div className="pb-3 flex flex-wrap gap-2 text-xs">
          <span className="text-slate-400 flex items-center gap-1 font-medium text-[11px]">
            <Sparkles className="h-3 w-3 text-amber-500" /> Suggestions:
          </span>
          <button
            onClick={() => handleSuggestedQuestion('What is the total amount and invoice date?')}
            className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded-full text-slate-700 transition-colors"
          >
            "What is the total amount and invoice date?"
          </button>
          <button
            onClick={() => handleSuggestedQuestion('What is the supplier GSTIN on the invoices?')}
            className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded-full text-slate-700 transition-colors"
          >
            "What is the supplier GSTIN?"
          </button>
          <button
            onClick={() => handleSuggestedQuestion('What items were ordered?')}
            className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded-full text-slate-700 transition-colors"
          >
            "What items were ordered?"
          </button>
        </div>
      )}

      {/* Input Form */}
      <form onSubmit={handleSend} className="pt-2">
        <div className="relative flex items-center">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              selectedDocId
                ? 'Ask a question about the selected document...'
                : 'Ask a question across all your documents...'
            }
            disabled={loading}
            className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 pr-24 text-sm text-slate-800 placeholder-slate-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="absolute right-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
