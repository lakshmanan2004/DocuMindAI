import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../api/client';
import {
  Search as SearchIcon,
  FileText,
  Sparkles,
  ExternalLink
} from 'lucide-react';
import { Card, Button } from '../ui';

const Search = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQuery = searchParams.get('q') || '';

  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [folders, setFolders] = useState([]);
  const [selectedFolder, setSelectedFolder] = useState('');

  // Load folders for scoping
  useEffect(() => {
    const loadFolders = async () => {
      try {
        const res = await api.get('/folders');
        setFolders(res.data?.folders || []);
      } catch (err) {
        console.error('Failed to load folders:', err);
      }
    };
    loadFolders();
  }, []);

  // Run search if initialQuery exists
  useEffect(() => {
    if (initialQuery.trim()) {
      handleSearch(initialQuery);
    }
  }, [initialQuery]);

  const handleSearch = async (searchTerm = query) => {
    if (!searchTerm.trim()) return;
    setLoading(true);
    setSearched(true);

    try {
      const params = {
        q: searchTerm.trim(),
        limit: 20
      };
      if (selectedFolder) params.folderId = selectedFolder;

      const res = await api.get('/search', { params });
      setResults(res.data?.results || []);
      setSearchParams({ q: searchTerm.trim() });
    } catch (err) {
      console.error('Hybrid search error:', err);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    handleSearch();
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#1C1C1E] dark:text-[#F2F2F7] flex items-center gap-2">
          <div className="h-7 w-7 rounded-[8px] bg-[#007AFF]/12 text-[#007AFF] flex items-center justify-center">
            <Sparkles className="h-4 w-4" />
          </div>
          Hybrid AI Search
        </h1>
        <p className="text-xs text-[#6B7280] dark:text-[#8E8E93]">
          Search across all documents combining vector semantic similarity (nomic-embed-text) and exact keyword matching.
        </p>
      </div>

      {/* Apple Spotlight Style Search Bar */}
      <Card className="p-4 shadow-sm">
        <form onSubmit={handleFormSubmit} className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-2.5">
            <div className="relative flex-1">
              <SearchIcon className="absolute left-3.5 top-3 h-4 w-4 text-[#8E8E93]" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search across all document text, invoices, marks, tests, terms..."
                className="w-full pl-10 pr-4 py-2.5 text-xs sm:text-sm rounded-[12px] bg-[#F2F2F7] dark:bg-[#2C2C2E] border border-black/5 dark:border-white/10 focus:outline-none focus:border-[#007AFF] focus:ring-2 focus:ring-[#007AFF]/20 text-[#1C1C1E] dark:text-[#F2F2F7] transition-all"
              />
            </div>

            {/* Folder Scoping */}
            <div className="flex items-center gap-2 sm:w-52 shrink-0">
              <select
                value={selectedFolder}
                onChange={(e) => setSelectedFolder(e.target.value)}
                className="w-full py-2.5 px-3 text-xs rounded-[12px] bg-[#F2F2F7] dark:bg-[#2C2C2E] border border-black/5 dark:border-white/10 text-[#1C1C1E] dark:text-[#F2F2F7] focus:outline-none focus:border-[#007AFF] focus:ring-2 focus:ring-[#007AFF]/20 cursor-pointer transition-all"
              >
                <option value="">All Folders</option>
                {folders.map((f) => (
                  <option key={f._id} value={f._id}>
                    📁 {f.name}
                  </option>
                ))}
              </select>
            </div>

            <Button type="submit" variant="primary" loading={loading} className="shrink-0">
              <SearchIcon className="h-4 w-4 mr-1.5" />
              Search
            </Button>
          </div>

          {/* Quick Suggestions */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-[11px] text-[#8E8E93] font-medium">Try searching:</span>
            {[
              'total marks obtained',
              'invoice grand total',
              'governing law jurisdiction',
              'hemoglobin test result',
              'passing percentage'
            ].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => {
                  setQuery(s);
                  handleSearch(s);
                }}
                className="text-[11px] px-3 py-1 rounded-full bg-black/5 dark:bg-white/10 text-[#1C1C1E] dark:text-[#F2F2F7] hover:bg-[#007AFF]/10 hover:text-[#007AFF] transition-all border border-black/5 dark:border-white/10 cursor-pointer active:scale-95"
              >
                {s}
              </button>
            ))}
          </div>
        </form>
      </Card>

      {/* Results Area */}
      <div className="space-y-4">
        <div className="flex items-center justify-between text-xs text-[#8E8E93]">
          <span>
            {searched
              ? `Found ${results.length} relevant snippet${results.length === 1 ? '' : 's'}`
              : 'Enter keywords or natural language questions to search.'}
          </span>
        </div>

        {loading && (
          <div className="py-16 text-center space-y-3">
            <div className="w-8 h-8 border-2 border-[#007AFF] border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs text-[#8E8E93]">Computing hybrid vector + keyword scores...</p>
          </div>
        )}

        {!loading && searched && results.length === 0 && (
          <Card className="py-16 text-center space-y-2">
            <SearchIcon className="h-8 w-8 text-[#8E8E93] mx-auto" />
            <p className="text-sm font-semibold text-[#1C1C1E] dark:text-[#F2F2F7]">No results found</p>
            <p className="text-xs text-[#8E8E93] max-w-sm mx-auto">
              We could not find any matching documents or text chunks for "{query}". Try broader search terms.
            </p>
          </Card>
        )}

        {!loading && results.length > 0 && (
          <div className="space-y-3">
            {results.map((res, idx) => (
              <Card
                key={idx}
                className="p-4 hover:border-[#007AFF]/40 hover:-translate-y-0.5 hover:shadow-md transition-all cursor-pointer group"
                onClick={() => navigate(`/documents/${res.documentId}`)}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-black/5 dark:border-white/10">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-[8px] bg-[#007AFF]/10 text-[#007AFF] shrink-0">
                      <FileText className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-[#1C1C1E] dark:text-[#F2F2F7] group-hover:text-[#007AFF] transition-colors flex items-center gap-1.5">
                        {res.documentName}
                        <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </h3>
                      <div className="flex items-center gap-2 text-[11px] text-[#8E8E93]">
                        <span>Page {res.pageNumber}</span>
                        {res.docType && <span>• {res.docType}</span>}
                      </div>
                    </div>
                  </div>

                  {/* Score Badges */}
                  <div className="flex items-center gap-2 text-[10px] font-mono shrink-0">
                    <span
                      title="Combined Hybrid Score"
                      className="px-2 py-0.5 rounded-full bg-[#007AFF]/12 text-[#007AFF] font-bold"
                    >
                      Total: {res.score?.toFixed(2) || '0.00'}
                    </span>
                    <span
                      title="Semantic Cosine Similarity"
                      className="px-2 py-0.5 rounded-full bg-[#34C759]/12 text-[#34C759] font-medium"
                    >
                      Semantic: {res.semanticScore?.toFixed(2) || '0.00'}
                    </span>
                    <span
                      title="Keyword BM25 Match"
                      className="px-2 py-0.5 rounded-full bg-black/5 dark:bg-white/10 text-[#8E8E93]"
                    >
                      Keyword: {res.keywordScore?.toFixed(2) || '0.00'}
                    </span>
                  </div>
                </div>

                {/* Text Snippet */}
                <p className="mt-3 text-xs leading-relaxed text-[#1C1C1E] dark:text-[#F2F2F7] font-mono bg-[#F2F2F7] dark:bg-[#2C2C2E] p-2.5 rounded-[10px] border border-black/5 dark:border-white/10 line-clamp-3">
                  "{res.text}"
                </p>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Search;
