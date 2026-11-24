import React, { useState } from 'react';
import { 
  FileText, 
  CheckCircle, 
  Layers, 
  Search, 
  UploadCloud, 
  HardDrive, 
  Clock, 
  ArrowRight,
  Eye,
  FileCheck,
  AlertCircle,
  Sparkles
} from 'lucide-react';
import { formatBytes } from '../services/db';

export default function DashboardView({
  documents = [],
  searchHistory = [],
  storageStats,
  onNavigate,
  onOpenViewer,
  onPerformSearch
}) {
  const [dashboardSearchQuery, setDashboardSearchQuery] = useState('');

  // Statistics calculation
  const totalUploaded = documents.length;
  const totalIndexed = documents.filter(d => d.indexStatus === 'indexed').length;
  const totalPages = documents.reduce((acc, d) => acc + (d.pageCount || 0), 0);
  const totalSearchable = totalIndexed;
  const recentDocs = [...documents].sort((a, b) => b.uploadDate - a.uploadDate).slice(0, 5);
  const recentHistory = searchHistory.slice(0, 6);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (dashboardSearchQuery.trim()) {
      onPerformSearch(dashboardSearchQuery.trim());
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Welcome Banner & Main Search Bar */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 text-white p-8 shadow-xl">
        <div className="relative z-10 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/30 border border-indigo-400/30 text-indigo-200 text-xs font-medium mb-3">
            <Sparkles className="w-3.5 h-3.5 text-indigo-300" />
            100% Client-Side Engine • IndexedDB & PDF.js • Tesseract OCR
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight mb-2 text-white">
            Search Across All Your PDF Documents
          </h1>
          <p className="text-slate-300 text-sm mb-6 leading-relaxed">
            Upload hundreds of documents. Search for any person name, phrase, address, reference number or multilingual text (English, Gujarati, Hindi) locally inside your browser.
          </p>

          {/* Prominent Search Bar */}
          <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder='Search for full name, address, number, "Sameed Shaikh", "Ahmedabad", "સમીદ શેખ"...'
                value={dashboardSearchQuery}
                onChange={(e) => setDashboardSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-white/40 focus:bg-white/15 transition text-sm font-medium"
              />
            </div>
            <button
              type="submit"
              className="px-6 py-3 rounded-xl bg-white text-indigo-950 font-bold text-sm shadow-md hover:bg-slate-100 transition shrink-0"
            >
              Search Documents
            </button>
          </form>

          {/* Recent search chips */}
          {recentHistory.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="text-xs text-indigo-200 font-medium flex items-center gap-1">
                <Clock className="w-3 h-3" /> Recent:
              </span>
              {recentHistory.map((h) => (
                <button
                  key={h.id}
                  onClick={() => onPerformSearch(h.query)}
                  className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-xs text-slate-200 border border-white/10 transition"
                >
                  {h.query}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Storage and Capacity Warning Alert Banner */}
      {storageStats?.warningMessage && (
        <div
          className={`p-4 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-fade-in ${
            storageStats.isStorageCritical || storageStats.isDocLimitReached
              ? 'bg-rose-50 border-rose-200 text-rose-900'
              : 'bg-amber-50 border-amber-200 text-amber-900'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`p-2 rounded-lg shrink-0 ${
                storageStats.isStorageCritical || storageStats.isDocLimitReached
                  ? 'bg-rose-100 text-rose-700'
                  : 'bg-amber-100 text-amber-700'
              }`}
            >
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider">
                {storageStats.isStorageCritical
                  ? 'Critical Storage Warning'
                  : storageStats.isDocLimitReached
                  ? 'Document Capacity Limit Reached'
                  : 'Storage & Capacity Notice'}
              </h4>
              <p className="text-xs mt-0.5 leading-relaxed font-medium">
                {storageStats.warningMessage}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => onNavigate('documents')}
              className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition shadow-xs"
            >
              Manage Documents
            </button>
            <button
              onClick={() => onNavigate('settings')}
              className="px-3 py-1.5 rounded-lg bg-slate-800 text-white text-xs font-semibold hover:bg-slate-700 transition shadow-xs"
            >
              Adjust Budget
            </button>
          </div>
        </div>
      )}

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Total Uploaded & Remaining Document Capacity */}
        <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Document Capacity
            </span>
            <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-800">
            {totalUploaded}{' '}
            <span className="text-xs font-normal text-slate-400">/ {storageStats?.maxDocs || 500}</span>
          </div>
          <p className="text-xs text-indigo-600 font-medium mt-1">
            {storageStats?.remainingDocCapacity ?? Math.max(0, 500 - totalUploaded)} slots remaining
          </p>
        </div>

        {/* Total Indexed & Searchable */}
        <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Indexed & Searchable
            </span>
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
              <CheckCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-800">{totalIndexed}</div>
          <p className="text-xs text-slate-400 mt-1">
            {totalPages} total pages indexed
          </p>
        </div>

        {/* Used Storage */}
        <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Used Storage
            </span>
            <div className="p-2 rounded-lg bg-sky-50 text-sky-600">
              <HardDrive className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-800">
            {storageStats?.formattedUsage || '0 MB'}
          </div>
          <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2 overflow-hidden">
            <div
              className={`h-1.5 rounded-full transition-all duration-300 ${
                storageStats?.isStorageCritical
                  ? 'bg-rose-500'
                  : storageStats?.isStorageWarning
                  ? 'bg-amber-500'
                  : 'bg-sky-500'
              }`}
              style={{ width: `${Math.min(100, Math.max(2, storageStats?.usagePercent || 2))}%` }}
            />
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            {storageStats?.usagePercent || 0}% of {storageStats?.formattedQuota || '2 GB'} budget
          </p>
        </div>

        {/* Available Storage */}
        <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Available Storage
            </span>
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
              <FileCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-800">
            {storageStats?.formattedAvailable || '2.00 GB'}
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Free budget space
          </p>
        </div>

        {/* Upload Limits Info */}
        <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Upload Limits
            </span>
            <div className="p-2 rounded-lg bg-purple-50 text-purple-600">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-bold text-slate-800">
            Max 25 MB
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Up to 10 files / batch
          </p>
        </div>
      </div>

      {/* Quick Actions & Recent Documents Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Recently Uploaded Documents */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-xs p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-slate-800 text-base">Recently Uploaded Documents</h3>
              <p className="text-xs text-slate-400">Latest files processed and stored in browser memory</p>
            </div>
            <button
              onClick={() => onNavigate('documents')}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 transition"
            >
              <span>View All</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {recentDocs.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-center">
              <div className="p-4 rounded-full bg-slate-100 text-slate-400 mb-3">
                <FileText className="w-8 h-8" />
              </div>
              <h4 className="text-sm font-semibold text-slate-700">No documents uploaded yet</h4>
              <p className="text-xs text-slate-400 max-w-sm mt-1 mb-4">
                Upload your first batch of PDF documents to begin searching.
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onNavigate('upload')}
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition"
                >
                  Upload PDFs Now
                </button>
                <button
                  onClick={() => onNavigate('upload')}
                  className="px-4 py-2 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold border border-indigo-200 transition"
                >
                  Load 5 Sample Test PDFs
                </button>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-400 uppercase tracking-wider font-semibold">
                    <th className="pb-3 font-semibold">Document Name</th>
                    <th className="pb-3 font-semibold">Pages</th>
                    <th className="pb-3 font-semibold">Size</th>
                    <th className="pb-3 font-semibold">Status</th>
                    <th className="pb-3 font-semibold text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recentDocs.map((doc) => (
                    <tr key={doc.id} className="hover:bg-slate-50/70 transition">
                      <td className="py-3 font-medium text-slate-800 max-w-xs truncate" title={doc.name}>
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-indigo-500 shrink-0" />
                          <span className="truncate">{doc.name}</span>
                        </div>
                      </td>
                      <td className="py-3 text-slate-600 font-mono">
                        {doc.pageCount || '-'}
                      </td>
                      <td className="py-3 text-slate-500 font-mono">
                        {formatBytes(doc.size)}
                      </td>
                      <td className="py-3">
                        {doc.indexStatus === 'indexed' ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Indexed
                          </span>
                        ) : doc.indexStatus === 'processing' ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-indigo-50 text-indigo-700 border border-indigo-200">
                            Processing
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-600">
                            {doc.indexStatus}
                          </span>
                        )}
                      </td>
                      <td className="py-3 text-right">
                        <button
                          onClick={() => onOpenViewer(doc.id, 1, '', doc.storagePath, doc.name)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-600 font-medium transition"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>View</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right 1 Col: Quick Upload & Actions */}
        <div className="space-y-6">
          {/* Quick Upload Drag & Drop Trigger */}
          <div 
            onClick={() => onNavigate('upload')}
            className="p-6 rounded-xl border-2 border-dashed border-indigo-200 hover:border-indigo-400 bg-indigo-50/40 hover:bg-indigo-50/70 transition cursor-pointer text-center group"
          >
            <div className="w-12 h-12 rounded-full bg-white shadow-xs text-indigo-600 flex items-center justify-center mx-auto mb-3 group-hover:scale-105 transition-transform">
              <UploadCloud className="w-6 h-6" />
            </div>
            <h4 className="font-bold text-slate-800 text-sm mb-1">Upload New PDF Documents</h4>
            <p className="text-xs text-slate-500 mb-4">
              Drag & drop PDFs or click to select multiple files from your computer
            </p>
            <span className="inline-block px-4 py-2 rounded-lg bg-indigo-600 text-white text-xs font-semibold shadow-xs group-hover:bg-indigo-700 transition">
              Go to Upload Manager
            </span>
          </div>

          {/* Search History Summary */}
          <div className="p-6 rounded-xl bg-white border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-bold text-slate-800 text-sm">Recent Search History</h4>
              <button
                onClick={() => onNavigate('history')}
                className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
              >
                All History
              </button>
            </div>

            {searchHistory.length === 0 ? (
              <p className="text-xs text-slate-400 py-3 text-center">No searches performed yet.</p>
            ) : (
              <div className="space-y-2">
                {searchHistory.slice(0, 4).map((item) => (
                  <div
                    key={item.id}
                    onClick={() => onPerformSearch(item.query)}
                    className="flex items-center justify-between p-2.5 rounded-lg hover:bg-slate-50 border border-slate-100 cursor-pointer transition text-xs"
                  >
                    <div className="flex items-center gap-2 font-medium text-slate-700 truncate max-w-[170px]">
                      <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{item.query}</span>
                    </div>
                    <span className="text-[11px] text-slate-400 font-mono">
                      {item.matchCount} matches
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
