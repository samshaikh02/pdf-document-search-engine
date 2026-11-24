import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Search, 
  Trash2, 
  RotateCw, 
  Eye, 
  Download, 
  Filter, 
  ArrowUpDown, 
  CheckSquare, 
  Square,
  FileCheck,
  AlertCircle,
  Clock,
  ChevronLeft,
  ChevronRight,
  Sparkles
} from 'lucide-react';
import { formatBytes, deleteDocument, getDocumentBlob } from '../services/db';
import { deleteCloudDocument, getSignedPdfUrl } from '../services/cloudDb';
import { queueManager } from '../services/queueManager';

export default function AllDocumentsView({
  documents = [],
  onOpenViewer,
  onNavigate
}) {
  const [filterQuery, setFilterQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // all, indexed, processing, ocr, failed
  const [sortField, setSortField] = useState('uploadDate'); // uploadDate, name, size, pageCount
  const [sortDirection, setSortDirection] = useState('desc'); // asc, desc
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  // Reset to page 1 on filter or search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [filterQuery, statusFilter]);

  // Filter documents
  const filtered = documents.filter((doc) => {
    const matchesName = doc.name.toLowerCase().includes(filterQuery.toLowerCase());
    if (!matchesName) return false;

    if (statusFilter === 'indexed') return doc.indexStatus === 'indexed';
    if (statusFilter === 'processing') return doc.indexStatus === 'processing' || doc.indexStatus === 'pending';
    if (statusFilter === 'ocr') return doc.ocrApplied;
    if (statusFilter === 'failed') return doc.indexStatus === 'failed';
    return true;
  });

  // Sort documents
  const sorted = [...filtered].sort((a, b) => {
    let aVal = a[sortField];
    let bVal = b[sortField];
    if (typeof aVal === 'string') aVal = aVal.toLowerCase();
    if (typeof bVal === 'string') bVal = bVal.toLowerCase();

    if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  const totalPages = Math.ceil(sorted.length / itemsPerPage) || 1;
  const paginatedDocs = sorted.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handleSortToggle = (field) => {
    if (sortField === field) {
      setSortDirection(dir => dir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleSelectAll = () => {
    if (selectedIds.size === paginatedDocs.length && paginatedDocs.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginatedDocs.map(d => d.id)));
    }
  };

  const toggleSelectOne = (id) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`Are you sure you want to delete ${selectedIds.size} selected document(s)?`)) return;

    setIsDeleting(true);
    try {
      for (const id of selectedIds) {
        const doc = sorted.find(d => d.id === id);
        if (doc?.storagePath) {
          await deleteCloudDocument(doc.id, doc.storagePath);
        } else {
          await deleteDocument(id);
        }
      }
      setSelectedIds(new Set());
    } catch (err) {
      console.error('Error deleting documents:', err);
      alert(`Deletion error: ${err.message}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteOne = async (id, name, storagePath) => {
    if (!window.confirm(`Delete "${name}" and all its indexed text?`)) return;
    try {
      if (storagePath) {
        await deleteCloudDocument(id, storagePath);
      } else {
        await deleteDocument(id);
      }
      const next = new Set(selectedIds);
      next.delete(id);
      setSelectedIds(next);
    } catch (err) {
      console.error('Error deleting document:', err);
      alert(`Delete failed: ${err.message}`);
    }
  };

  const handleReindex = async (id) => {
    try {
      await queueManager.reindexDocument(id);
    } catch (err) {
      alert(`Could not reindex: ${err.message}`);
    }
  };

  const handleDownload = async (doc) => {
    try {
      if (doc.storagePath) {
        const signedUrl = await getSignedPdfUrl(doc.storagePath, 3600);
        const a = document.createElement('a');
        a.href = signedUrl;
        a.download = doc.name;
        a.target = '_blank';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        return;
      }

      const blob = await getDocumentBlob(doc.id);
      if (!blob) throw new Error('File not found in storage');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(`Download failed: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800">All PDF Documents</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage your document collection, inspect indexing status, and trigger re-indexing.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {selectedIds.size > 0 && (
            <button
              onClick={handleDeleteSelected}
              disabled={isDeleting}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-xs transition"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Selected ({selectedIds.size})</span>
            </button>
          )}

          <button
            onClick={() => onNavigate('upload')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition"
          >
            <span>Upload More PDFs</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3 text-xs">
        {/* Search by filename */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            placeholder="Filter by document filename..."
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto">
          {[
            { id: 'all', label: 'All Documents' },
            { id: 'indexed', label: 'Indexed' },
            { id: 'ocr', label: 'OCR Applied' },
            { id: 'processing', label: 'Processing' },
            { id: 'failed', label: 'Failed' },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setStatusFilter(f.id)}
              className={`px-3 py-1.5 rounded-lg font-medium transition ${
                statusFilter === f.id
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Documents Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {sorted.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-xs">
            <FileText className="w-8 h-8 mx-auto text-slate-300 mb-2" />
            <p className="font-semibold text-slate-600 text-sm">No documents found</p>
            <p className="mt-1">
              {filterQuery ? 'No documents match your filter query.' : 'Upload PDF documents to populate this list.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-500 uppercase tracking-wider font-semibold">
                  <th className="py-3 px-4 w-10">
                    <button
                      onClick={handleSelectAll}
                      className="text-slate-400 hover:text-slate-600"
                    >
                      {selectedIds.size === sorted.length && sorted.length > 0 ? (
                        <CheckSquare className="w-4 h-4 text-indigo-600" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>
                  </th>

                  <th 
                    onClick={() => handleSortToggle('name')}
                    className="py-3 px-3 cursor-pointer hover:text-slate-800 transition"
                  >
                    <div className="flex items-center gap-1">
                      <span>Document Name</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>

                  <th 
                    onClick={() => handleSortToggle('pageCount')}
                    className="py-3 px-3 cursor-pointer hover:text-slate-800 transition"
                  >
                    <div className="flex items-center gap-1">
                      <span>Pages</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>

                  <th 
                    onClick={() => handleSortToggle('size')}
                    className="py-3 px-3 cursor-pointer hover:text-slate-800 transition"
                  >
                    <div className="flex items-center gap-1">
                      <span>File Size</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>

                  <th className="py-3 px-3">
                    <span>OCR Status</span>
                  </th>

                  <th className="py-3 px-3">
                    <span>Index Status</span>
                  </th>

                  <th 
                    onClick={() => handleSortToggle('uploadDate')}
                    className="py-3 px-3 cursor-pointer hover:text-slate-800 transition"
                  >
                    <div className="flex items-center gap-1">
                      <span>Date Added</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>

                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {paginatedDocs.map((doc) => {
                  const isSelected = selectedIds.has(doc.id);
                  return (
                    <tr
                      key={doc.id}
                      className={`hover:bg-slate-50/80 transition ${isSelected ? 'bg-indigo-50/30' : ''}`}
                    >
                      <td className="py-3 px-4">
                        <button
                          onClick={() => toggleSelectOne(doc.id)}
                          className="text-slate-400 hover:text-slate-600"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-indigo-600" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                      </td>

                      <td className="py-3 px-3 font-semibold text-slate-800 max-w-sm truncate" title={doc.name}>
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-indigo-500 shrink-0" />
                          <span className="truncate">{doc.name}</span>
                        </div>
                      </td>

                      <td className="py-3 px-3 font-mono text-slate-600">
                        {doc.pageCount || '-'}
                      </td>

                      <td className="py-3 px-3 font-mono text-slate-500">
                        {formatBytes(doc.size)}
                      </td>

                      <td className="py-3 px-3">
                        {doc.ocrApplied ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-purple-50 text-purple-700 border border-purple-200">
                            OCR ({doc.ocrPageCount || 1} pgs)
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[11px]">Direct Text</span>
                        )}
                      </td>

                      <td className="py-3 px-3">
                        {doc.indexStatus === 'indexed' ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Searchable
                          </span>
                        ) : doc.indexStatus === 'processing' ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-indigo-50 text-indigo-700 border border-indigo-200">
                            Processing
                          </span>
                        ) : doc.indexStatus === 'failed' ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-rose-50 text-rose-700 border border-rose-200" title={doc.error}>
                            Failed
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[11px]">{doc.indexStatus}</span>
                        )}
                      </td>

                      <td className="py-3 px-3 text-slate-400">
                        {new Date(doc.uploadDate).toLocaleDateString()}
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => onOpenViewer(doc.id, 1, '', doc.storagePath, doc.name)}
                            className="p-1.5 rounded hover:bg-indigo-50 text-slate-500 hover:text-indigo-600 transition"
                            title="Open in PDF Viewer"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => handleDownload(doc)}
                            className="p-1.5 rounded hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition"
                            title="Download PDF"
                          >
                            <Download className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => handleReindex(doc.id)}
                            className="p-1.5 rounded hover:bg-amber-50 text-slate-500 hover:text-amber-600 transition"
                            title="Re-index Document"
                          >
                            <RotateCw className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => handleDeleteOne(doc.id, doc.name, doc.storagePath)}
                            className="p-1.5 rounded hover:bg-rose-50 text-slate-500 hover:text-rose-600 transition"
                            title="Delete Document"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Pagination Controls for Large Collections (Scalable to 5,000 PDFs) */}
            {totalPages > 1 && (
              <div className="p-4 border-t border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                <span className="text-slate-500 font-medium">
                  Showing <strong className="text-slate-800">{(currentPage - 1) * itemsPerPage + 1}</strong> to{' '}
                  <strong className="text-slate-800">{Math.min(currentPage * itemsPerPage, sorted.length)}</strong> of{' '}
                  <strong className="text-slate-800">{sorted.length}</strong> documents
                </span>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage <= 1}
                    className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
                    title="Previous Page"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>

                  <span className="px-3 py-1 font-semibold text-slate-700">
                    Page {currentPage} of {totalPages}
                  </span>

                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage >= totalPages}
                    className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
                    title="Next Page"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
