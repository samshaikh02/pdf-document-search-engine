import React, { useState, useEffect } from 'react';
import { 
  Search, 
  SlidersHorizontal, 
  FileText, 
  ExternalLink, 
  ChevronRight, 
  ChevronLeft, 
  Clock, 
  Sparkles, 
  Layers, 
  Hash, 
  Filter, 
  Check, 
  X,
  FileCheck,
  Calendar,
  Eye
} from 'lucide-react';
import { formatBytes } from '../services/db';
import { searchIndexedDocuments } from '../services/searchEngine';

export default function SearchView({ initialQuery = '', onOpenViewer }) {
  const [query, setQuery] = useState(initialQuery);
  const [isSearching, setIsSearching] = useState(false);
  const [searchOutput, setSearchOutput] = useState(null);
  
  // Search options
  const [exactPhrase, setExactPhrase] = useState(false);
  const [matchAllWords, setMatchAllWords] = useState(true);
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const resultsPerPage = 10;

  // Perform search
  const performSearch = async (searchTerm, optionsOverride = {}) => {
    const q = (searchTerm !== undefined ? searchTerm : query).trim();
    if (!q) {
      setSearchOutput(null);
      return;
    }

    setIsSearching(true);
    try {
      const results = await searchIndexedDocuments(q, {
        exactPhrase: optionsOverride.exactPhrase ?? exactPhrase,
        matchAllWords: optionsOverride.matchAllWords ?? matchAllWords,
        caseSensitive: optionsOverride.caseSensitive ?? caseSensitive
      });
      setSearchOutput(results);
      setCurrentPage(1);
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setIsSearching(false);
    }
  };

  useEffect(() => {
    if (initialQuery && initialQuery.trim()) {
      setQuery(initialQuery);
      performSearch(initialQuery);
    }
  }, [initialQuery]);

  const handleFormSubmit = (e) => {
    e.preventDefault();
    performSearch(query);
  };

  // Preset search sample chips for easy user testing
  const sampleSearches = [
    { label: 'Sameed Shaikh', desc: 'Full Name' },
    { label: 'Development Agreement', desc: 'Exact Phrase' },
    { label: 'Ahmedabad', desc: 'Location' },
    { label: '123456', desc: 'Reference Number' },
    { label: 'સમીદ શેખ', desc: 'Gujarati' },
    { label: 'समीर शेख', desc: 'Hindi' }
  ];

  const handleChipClick = (term) => {
    setQuery(term);
    performSearch(term);
  };

  // Pagination calculation
  const totalResults = searchOutput?.results?.length || 0;
  const totalPages = Math.ceil(totalResults / resultsPerPage) || 1;
  const paginatedResults = searchOutput?.results?.slice(
    (currentPage - 1) * resultsPerPage,
    currentPage * resultsPerPage
  ) || [];

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Search Header & Controls */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6">
        <form onSubmit={handleFormSubmit} className="space-y-4">
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="relative flex-1 w-full">
              <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder='Search across all PDFs: "Sameed Shaikh", "સમીદ શેખ", "Ahmedabad", "123456"...'
                className="w-full pl-12 pr-10 py-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 placeholder-slate-400 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => {
                    setQuery('');
                    setSearchOutput(null);
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-2 px-3.5 py-3 rounded-xl border text-xs font-semibold transition shrink-0 ${
                  showFilters || exactPhrase || caseSensitive || !matchAllWords
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                <SlidersHorizontal className="w-4 h-4" />
                <span>Filters</span>
              </button>

              <button
                type="submit"
                disabled={isSearching}
                className="flex-1 sm:flex-none px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-xs shadow-indigo-600/30 transition shrink-0 flex items-center justify-center gap-2"
              >
                {isSearching ? (
                  <span>Searching...</span>
                ) : (
                  <>
                    <Search className="w-4 h-4" />
                    <span>Search</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Search Options / Filters */}
          {showFilters && (
            <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center gap-4 text-xs text-slate-600 animate-fade-in">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={exactPhrase}
                  onChange={(e) => {
                    setExactPhrase(e.target.checked);
                    if (query.trim()) performSearch(query, { exactPhrase: e.target.checked });
                  }}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                />
                <span className="font-medium text-slate-700">Exact Phrase Match</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={matchAllWords && !exactPhrase}
                  disabled={exactPhrase}
                  onChange={(e) => {
                    setMatchAllWords(e.target.checked);
                    if (query.trim()) performSearch(query, { matchAllWords: e.target.checked });
                  }}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4 disabled:opacity-40"
                />
                <span className="font-medium text-slate-700">Match All Words</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={caseSensitive}
                  onChange={(e) => {
                    setCaseSensitive(e.target.checked);
                    if (query.trim()) performSearch(query, { caseSensitive: e.target.checked });
                  }}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                />
                <span className="font-medium text-slate-700">Case Sensitive</span>
              </label>
            </div>
          )}

          {/* Sample quick search pills */}
          <div className="flex flex-wrap items-center gap-2 pt-2">
            <span className="text-xs text-slate-400 font-medium flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
              Try sample query:
            </span>
            {sampleSearches.map((item, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleChipClick(item.label)}
                className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 border border-slate-200 text-xs text-slate-600 font-medium transition"
              >
                <span>{item.label}</span>
                <span className="ml-1.5 text-[10px] text-slate-400">({item.desc})</span>
              </button>
            ))}
          </div>
        </form>
      </div>

      {/* Search Results Summary Header */}
      {searchOutput && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-1 text-xs">
          <div className="text-slate-600 font-medium">
            Found <strong className="text-indigo-600 font-bold">{searchOutput.totalMatches}</strong> occurrence{searchOutput.totalMatches === 1 ? '' : 's'} across{' '}
            <strong className="text-slate-800 font-bold">{searchOutput.totalDocumentsMatched}</strong> document{searchOutput.totalDocumentsMatched === 1 ? '' : 's'}{' '}
            in <span className="font-mono text-slate-500">{searchOutput.searchTimeMs}ms</span>
          </div>
          {totalResults > 0 && (
            <div className="text-slate-400">
              Showing page {currentPage} of {totalPages}
            </div>
          )}
        </div>
      )}

      {/* Search Results List */}
      {searchOutput && searchOutput.totalMatches === 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center max-w-lg mx-auto shadow-xs">
          <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
            <Search className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-slate-800 text-base mb-1">No matching text found</h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            No occurrences of "{searchOutput.query}" were found across your indexed documents. Check spelling or try partial words.
          </p>
        </div>
      )}

      {searchOutput && paginatedResults.length > 0 && (
        <div className="space-y-4">
          {paginatedResults.map((docResult) => (
            <div
              key={docResult.docId}
              className="bg-white rounded-xl border border-slate-200 shadow-xs hover:shadow-md transition-shadow p-5 space-y-4"
            >
              {/* Document Header Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600 shrink-0">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-800 tracking-tight" title={docResult.name}>
                      {docResult.name}
                    </h3>
                    <div className="flex items-center gap-3 text-xs text-slate-400 mt-0.5">
                      <span>{formatBytes(docResult.size)}</span>
                      <span>•</span>
                      <span>{docResult.pageCount} Pages</span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(docResult.uploadDate).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                    {docResult.totalOccurrences} occurrence{docResult.totalOccurrences === 1 ? '' : 's'}
                  </span>
                  <button
                    onClick={() => onOpenViewer(docResult.docId, docResult.pages[0]?.pageNumber || 1, searchOutput.query, docResult.storagePath, docResult.name)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Open PDF</span>
                  </button>
                </div>
              </div>

              {/* Matched Pages & Snippets */}
              <div className="space-y-2.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Matches on {docResult.pages.length} page{docResult.pages.length === 1 ? '' : 's'}:
                </span>

                <div className="grid grid-cols-1 gap-2">
                  {docResult.pages.map((p) => (
                    <div
                      key={p.pageNumber}
                      className="p-3 rounded-lg bg-slate-50 border border-slate-100 hover:border-indigo-200 transition space-y-1.5"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-700">
                            Page {p.pageNumber}
                          </span>
                          <span className="text-[11px] text-slate-400">
                            ({p.occurrencesCount} occurrence{p.occurrencesCount === 1 ? '' : 's'})
                          </span>
                          {p.hasOcr && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200">
                              OCR Page
                            </span>
                          )}
                        </div>

                        <button
                          onClick={() => onOpenViewer(docResult.docId, p.pageNumber, searchOutput.query, docResult.storagePath, docResult.name)}
                          className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 transition"
                        >
                          <span>Go to Page {p.pageNumber}</span>
                          <ExternalLink className="w-3 h-3" />
                        </button>
                      </div>

                      {/* Snippet Previews */}
                      <div className="space-y-1 text-xs text-slate-600">
                        {p.snippets.map((snip, sIdx) => (
                          <div key={sIdx} className="font-sans leading-relaxed bg-white p-2 rounded border border-slate-200/60">
                            <span>{snip.before}</span>
                            <mark className="search-highlight mx-0.5">{snip.match}</mark>
                            <span>{snip.after}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}

          {/* Results Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-4">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                className="p-2 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <div className="text-xs font-semibold text-slate-700 px-3">
                Page {currentPage} of {totalPages}
              </div>

              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                className="p-2 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
