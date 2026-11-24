import React, { useState } from 'react';
import { Search, UploadCloud, Loader2, Cloud } from 'lucide-react';

export default function Header({ 
  onQuickSearch, 
  onQuickUpload, 
  queueState, 
  activeTabTitle, 
  isCloudActive 
}) {
  const [searchInput, setSearchInput] = useState('');

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (searchInput.trim()) {
      onQuickSearch(searchInput.trim());
    }
  };

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between shadow-xs shrink-0">
      {/* Current Section Title */}
      <div className="flex items-center gap-3">
        <h2 className="text-lg font-bold text-slate-800 tracking-tight">
          {activeTabTitle}
        </h2>
        
        {/* Background queue indicator badge */}
        {queueState?.isProcessing && (
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-xs font-medium text-indigo-700 animate-pulse">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" />
            <span>Processing Queue ({queueState.totalProcessing + queueState.totalPending} left)</span>
          </div>
        )}
      </div>

      {/* Global Quick Search & Actions */}
      <div className="flex items-center gap-3">
        {/* Search Bar */}
        <form onSubmit={handleSearchSubmit} className="relative w-48 md:w-72">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search across all PDFs (Press Enter)..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-100 border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
          />
        </form>

        {/* Quick Upload Button */}
        <button
          onClick={onQuickUpload}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs shadow-indigo-600/30 transition shrink-0"
        >
          <UploadCloud className="w-4 h-4" />
          <span className="hidden sm:inline">Upload PDF</span>
        </button>

        {/* Cloud Status Badge */}
        <div className="flex items-center gap-2 pl-2 border-l border-slate-200 text-xs">
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full font-medium ${
            isCloudActive 
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
              : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
          }`}>
            <span className={`w-2 h-2 rounded-full ${isCloudActive ? 'bg-emerald-500 animate-pulse' : 'bg-indigo-500'}`} />
            <Cloud className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{isCloudActive ? 'Live Cloud Sync' : 'Local Mode'}</span>
          </div>
        </div>
      </div>
    </header>
  );
}
