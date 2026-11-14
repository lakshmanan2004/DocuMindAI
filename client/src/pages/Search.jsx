import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../api/client';
import {
  Search as SearchIcon,
  FileText,
  Sparkles,
  ExternalLink,
  Layers,
  ChevronRight,
  Filter,
  BarChart3,
  Calendar,
  Folder
} from 'lucide-react';
import { Card, Button, StatusBadge } from '../ui';

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
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-indigo-600" />
          Hybrid AI Search
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Search across all documents combining vector semantic similarity (nomic-embed-text) and exact keyword matching.
        </p>
      </div>

      {/* Search Input Bar */}
      <Card className="p-4 shadow-sm">
        <form onSubmit={handleFormSubmit} className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <SearchIcon className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search across all document text, invoices, marks, tests, terms..."
                className="w-full pl-10 pr-4 py-2 text-sm rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white"
              />
            </div>

            {/* Folder Scoping */}
            <div className="flex items-center gap-2 sm:w-56 shrink-0">
              <select
                value={selectedFolder}
                onChange={(e) => setSelectedFolder(e.target.value)}
                className="w-full py-2 px-3 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
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
            <span className="text-[11px] text-slate-400 font-medium">Try searching:</span>
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
                className="text-[11px] px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-950/40 dark:hover:text-indigo-400 transition-colors border border-slate-200/60 dark:border-slate-700"
              >
                {s}
              </button>
            ))}
          </div>
        </form>
      </Card>

      {/* Results Area */}
      <div className="space-y-4">
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>
            {searched
              ? `Found ${results.length} relevant snippet${results.length === 1 ? '' : 's'}`
              : 'Enter keywords or natural language questions to search.'}
          </span>
        </div>

        {loading && (
          <div className="py-16 text-center space-y-3">
            <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs text-slate-500">Computing hybrid vector + keyword scores...</p>
          </div>
        )}

        {!loading && searched && results.length === 0 && (
          <Card className="py-16 text-center space-y-2">
            <SearchIcon className="h-8 w-8 text-slate-400 mx-auto" />
            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">No results found</p>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              We could not find any matching documents or text chunks for "{query}". Try broader search terms.
            </p>
          </Card>
        )}

        {!loading && results.length > 0 && (
          <div className="space-y-3">
            {results.map((res, idx) => (
              <Card
                key={idx}
                className="p-4 hover:border-indigo-200 dark:hover:border-indigo-800 transition-all cursor-pointer group"
                onClick={() => navigate(`/review/${res.documentId}`)}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 shrink-0">
                      <FileText className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 transition-colors flex items-center gap-1.5">
                        {res.documentName}
                        <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </h3>
                      <div className="flex items-center gap-2 text-[11px] text-slate-400">
                        <span>Page {res.pageNumber}</span>
                        {res.docType && <span>• {res.docType}</span>}
                      </div>
                    </div>
                  </div>

                  {/* Score Badges */}
                  <div className="flex items-center gap-2 text-[10px] font-mono shrink-0">
                    <span
                      title="Combined Hybrid Score"
                      className="px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 font-bold border border-indigo-200 dark:border-indigo-800"
                    >
                      Total: {res.score?.toFixed(2) || '0.00'}
                    </span>
                    <span
                      title="Semantic Cosine Similarity"
                      className="px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800"
                    >
                      Semantic: {res.semanticScore?.toFixed(2) || '0.00'}
                    </span>
                    <span
                      title="Keyword BM25 Match"
                      className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                    >
                      Keyword: {res.keywordScore?.toFixed(2) || '0.00'}
                    </span>
                  </div>
                </div>

                {/* Text Snippet */}
                <p className="mt-3 text-xs leading-relaxed text-slate-700 dark:text-slate-300 font-mono bg-slate-50 dark:bg-slate-900/60 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800 line-clamp-3">
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

