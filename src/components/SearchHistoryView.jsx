import React from 'react';
import { History, Search, Trash2, ArrowUpRight, Calendar, FileText } from 'lucide-react';
import { clearSearchHistory, deleteSearchHistoryItem } from '../services/db';
import { clearCloudSearchHistory, deleteCloudSearchHistoryItem } from '../services/cloudDb';

export default function SearchHistoryView({ searchHistory = [], onRepeatSearch, isCloudActive }) {
  const handleClearAll = async () => {
    if (window.confirm('Are you sure you want to clear your entire search history?')) {
      if (isCloudActive) {
        await clearCloudSearchHistory();
      } else {
        await clearSearchHistory();
      }
    }
  };

  const handleDeleteOne = async (id) => {
    if (isCloudActive) {
      await deleteCloudSearchHistoryItem(id);
    } else {
      await deleteSearchHistoryItem(id);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Search History</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            View previous queries and quickly repeat searches across your PDF library.
          </p>
        </div>

        {searchHistory.length > 0 && (
          <button
            onClick={handleClearAll}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-600 text-xs font-semibold transition"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear All History</span>
          </button>
        )}
      </div>

      {/* History List Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {searchHistory.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-xs">
            <History className="w-8 h-8 mx-auto text-slate-300 mb-2" />
            <p className="font-semibold text-slate-600 text-sm">No search history</p>
            <p className="mt-1">Searches you perform will be saved here locally for quick reference.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {searchHistory.map((item) => (
              <div
                key={item.id}
                className="p-4 hover:bg-slate-50/70 transition flex items-center justify-between text-xs"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600 shrink-0">
                    <Search className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <span className="font-bold text-slate-800 text-sm truncate block">
                      {item.query}
                    </span>
                    <div className="flex items-center gap-2 text-slate-400 text-[11px] mt-0.5">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(item.timestamp).toLocaleString()}
                      </span>
                      <span>•</span>
                      <span>
                        {item.matchCount || 0} occurrence{item.matchCount === 1 ? '' : 's'} across {item.docCount || 0} doc{item.docCount === 1 ? '' : 's'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => onRepeatSearch(item.query)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold text-xs transition"
                  >
                    <span>Search Again</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => handleDeleteOne(item.id)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                    title="Delete Entry"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
