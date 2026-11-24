import React, { useState, useRef, useEffect } from 'react';
import { 
  UploadCloud, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Trash2, 
  RotateCw, 
  Pause, 
  Play, 
  X, 
  FileCheck,
  Cpu,
  Layers,
  Sparkles,
  Loader2
} from 'lucide-react';
import { formatBytes } from '../services/db';
import { queueManager } from '../services/queueManager';
import { generateAndLoadSampleSuite } from '../services/sampleDocsGenerator';

export default function UploadView({ onOpenViewer, storageStats, onStorageUpdate, onNavigate }) {
  const [queueState, setQueueState] = useState(queueManager.getState());
  const [isDragging, setIsDragging] = useState(false);
  const [isGeneratingSamples, setIsGeneratingSamples] = useState(false);
  const [uploadAlerts, setUploadAlerts] = useState([]);
  const fileInputRef = useRef(null);

  useEffect(() => {
    const unsubscribe = queueManager.subscribe((state) => {
      setQueueState(state);
      if (state.lastValidationErrors && state.lastValidationErrors.length > 0) {
        setUploadAlerts(state.lastValidationErrors);
      }
    });
    return unsubscribe;
  }, []);

  const handleFilesSelected = async (files) => {
    if (!files || files.length === 0) return;
    setUploadAlerts([]);
    const res = await queueManager.addFiles(Array.from(files));
    if (res.errors && res.errors.length > 0) {
      setUploadAlerts(res.errors);
    }
    if (onStorageUpdate) {
      onStorageUpdate();
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleGenerateSamples = async () => {
    setIsGeneratingSamples(true);
    setUploadAlerts([]);
    try {
      await generateAndLoadSampleSuite();
      if (onStorageUpdate) {
        onStorageUpdate();
      }
    } catch (err) {
      console.error('Failed to generate sample docs:', err);
      setUploadAlerts([`Error loading sample suite: ${err.message}`]);
    } finally {
      setIsGeneratingSamples(false);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFilesSelected(e.dataTransfer.files);
    }
  };

  const completedCount = queueState.totalCompleted;
  const totalInQueue = queueState.queue.length;
  const overallProgress = totalInQueue > 0 ? Math.round((completedCount / totalInQueue) * 100) : 0;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Upload Header & Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800">PDF Upload & Processing Center</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Select or drag hundreds of PDF documents. Processing runs locally page-by-page.
          </p>
        </div>

        {/* Batch Queue Control Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleGenerateSamples}
            disabled={isGeneratingSamples}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold border border-indigo-200 shadow-xs transition"
          >
            {isGeneratingSamples ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" />
            ) : (
              <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
            )}
            <span>{isGeneratingSamples ? 'Generating Suite...' : 'Load 5 Test PDFs'}</span>
          </button>

          {queueState.isPaused ? (
            <button
              onClick={() => queueManager.resume()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition"
            >
              <Play className="w-3.5 h-3.5" />
              <span>Resume Queue</span>
            </button>
          ) : (
            <button
              onClick={() => queueManager.pause()}
              disabled={!queueState.isProcessing && queueState.totalPending === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 disabled:opacity-40 text-white text-xs font-semibold shadow-xs transition"
            >
              <Pause className="w-3.5 h-3.5" />
              <span>Pause Queue</span>
            </button>
          )}

          <button
            onClick={() => queueManager.clearCompleted()}
            disabled={queueState.totalCompleted === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 disabled:opacity-40 text-slate-700 text-xs font-medium transition"
          >
            <span>Clear Completed</span>
          </button>
        </div>
      </div>

      {/* System Limits & Storage Capacity Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
        <div className="p-3 rounded-lg bg-white border border-slate-200">
          <span className="text-[10px] uppercase font-bold text-slate-400 block">Collection Limit</span>
          <span className="font-bold text-slate-800 text-sm">
            {storageStats?.currentDocCount || 0} / {storageStats?.maxDocs || 500}
          </span>
          <span className="text-[10px] text-indigo-600 block">
            {storageStats?.remainingDocCapacity ?? 500} slots remaining
          </span>
        </div>

        <div className="p-3 rounded-lg bg-white border border-slate-200">
          <span className="text-[10px] uppercase font-bold text-slate-400 block">Max File Size</span>
          <span className="font-bold text-slate-800 text-sm">25 MB / PDF</span>
          <span className="text-[10px] text-slate-400 block">Enforced strictly</span>
        </div>

        <div className="p-3 rounded-lg bg-white border border-slate-200">
          <span className="text-[10px] uppercase font-bold text-slate-400 block">Storage Budget</span>
          <span className="font-bold text-slate-800 text-sm">{storageStats?.formattedQuota || '2.00 GB'}</span>
          <span className="text-[10px] text-slate-400 block">{storageStats?.formattedAvailable || '2.00 GB'} free</span>
        </div>

        <div className="p-3 rounded-lg bg-white border border-slate-200">
          <span className="text-[10px] uppercase font-bold text-slate-400 block">Simultaneous Batch</span>
          <span className="font-bold text-slate-800 text-sm">Max 10 Files</span>
          <span className="text-[10px] text-slate-400 block">Safe queueing</span>
        </div>

        <div className="p-3 rounded-lg bg-white border border-slate-200 col-span-2 sm:col-span-1">
          <span className="text-[10px] uppercase font-bold text-slate-400 block">OCR Concurrency</span>
          <span className="font-bold text-slate-800 text-sm">1–2 PDFs</span>
          <span className="text-[10px] text-purple-600 block">Controlled batches</span>
        </div>
      </div>

      {/* Storage Alert Warning */}
      {storageStats?.warningMessage && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 flex items-start gap-3 text-xs animate-fade-in">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-bold block">Storage Capacity Warning</span>
            <span>{storageStats.warningMessage}</span>
          </div>
          {onNavigate && (
            <button
              onClick={() => onNavigate('documents')}
              className="px-2.5 py-1 rounded bg-amber-200 hover:bg-amber-300 text-amber-950 font-semibold transition"
            >
              Free Space
            </button>
          )}
        </div>
      )}

      {/* Upload Validation Alerts */}
      {uploadAlerts.length > 0 && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs space-y-1 animate-fade-in">
          <div className="flex items-center justify-between font-bold text-rose-800 mb-1">
            <span className="flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 text-rose-600" />
              Upload Notices & Restrictions
            </span>
            <button
              onClick={() => setUploadAlerts([])}
              className="text-rose-500 hover:text-rose-700"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <ul className="list-disc list-inside space-y-0.5 text-rose-700">
            {uploadAlerts.map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
        </div>
      )}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-2xl p-8 md:p-12 text-center cursor-pointer transition-all ${
          isDragging
            ? 'border-indigo-600 bg-indigo-50/80 scale-[1.005]'
            : 'border-slate-300 hover:border-indigo-400 bg-white hover:bg-slate-50/50 shadow-xs'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,application/pdf"
          multiple
          className="hidden"
          onChange={(e) => handleFilesSelected(e.target.files)}
        />

        <div className="max-w-md mx-auto flex flex-col items-center">
          <div className="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-4 shadow-inner">
            <UploadCloud className="w-8 h-8" />
          </div>
          <h3 className="text-base font-bold text-slate-800 mb-1">
            Drag & Drop your PDF files here, or <span className="text-indigo-600 hover:underline">Browse</span>
          </h3>
          <p className="text-xs text-slate-500 mb-4 leading-relaxed">
            Support for single files or hundreds of PDFs simultaneously.
            Extracts text from English, Gujarati, Hindi, and scanned pages with OCR automatically.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-2 text-[11px] text-slate-400 font-medium">
            <span className="px-2.5 py-1 rounded-md bg-slate-100 text-slate-600">PDF.js Text Extraction</span>
            <span className="px-2.5 py-1 rounded-md bg-slate-100 text-slate-600">Tesseract OCR Support</span>
            <span className="px-2.5 py-1 rounded-md bg-slate-100 text-slate-600">Stored in IndexedDB</span>
          </div>
        </div>
      </div>

      {/* Queue Progress Summary Card */}
      {queueState.queue.length > 0 && (
        <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-xs space-y-3">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
            <span>Overall Batch Progress ({completedCount} of {totalInQueue} Completed)</span>
            <span className="font-mono text-indigo-600">{overallProgress}%</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
            <div
              className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${overallProgress}%` }}
            />
          </div>
          <div className="flex items-center gap-4 text-xs text-slate-500 pt-1">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-indigo-500 animate-ping" />
              Processing: <strong className="text-slate-800">{queueState.totalProcessing}</strong>
            </span>
            <span>
              Pending: <strong className="text-slate-800">{queueState.totalPending}</strong>
            </span>
            <span>
              Completed: <strong className="text-emerald-600">{queueState.totalCompleted}</strong>
            </span>
            {queueState.totalFailed > 0 && (
              <span>
                Failed: <strong className="text-rose-600">{queueState.totalFailed}</strong>
              </span>
            )}
          </div>
        </div>
      )}

      {/* Processing Queue Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <h3 className="font-bold text-slate-800 text-sm">Processing Queue</h3>
          <span className="text-xs text-slate-400">
            {queueState.queue.length} item{queueState.queue.length === 1 ? '' : 's'} in queue
          </span>
        </div>

        {queueState.queue.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-xs">
            No files currently in the processing queue. Upload PDFs above to begin.
          </div>
        ) : (
          <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto">
            {queueState.queue.map((item) => (
              <div key={item.id} className="p-4 hover:bg-slate-50/60 transition flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
                {/* File info */}
                <div className="flex items-start gap-3 min-w-0 md:w-1/3">
                  <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600 shrink-0 mt-0.5">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-800 truncate" title={item.name}>
                      {item.name}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      {formatBytes(item.size)}
                      {item.totalPages > 0 && ` • ${item.page}/${item.totalPages} Pages`}
                    </p>
                  </div>
                </div>

                {/* Progress / Status Bar */}
                <div className="flex-1 max-w-md">
                  <div className="flex items-center justify-between mb-1 text-[11px]">
                    <span className="text-slate-600 font-medium truncate max-w-[280px]">
                      {item.message}
                    </span>
                    <span className="font-mono text-slate-400 font-semibold shrink-0 ml-2">
                      {item.progress}%
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                    <div
                      className={`h-1.5 rounded-full transition-all duration-200 ${
                        item.status === 'completed'
                          ? 'bg-emerald-500'
                          : item.status === 'failed'
                          ? 'bg-rose-500'
                          : 'bg-indigo-600'
                      }`}
                      style={{ width: `${item.progress}%` }}
                    />
                  </div>
                </div>

                {/* Status Badges & Actions */}
                <div className="flex items-center justify-end gap-2 shrink-0">
                  {item.status === 'completed' ? (
                    <button
                      onClick={() => onOpenViewer(item.docId, 1)}
                      className="px-2.5 py-1 rounded bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-medium text-[11px] flex items-center gap-1 transition"
                    >
                      <FileCheck className="w-3.5 h-3.5" />
                      <span>View PDF</span>
                    </button>
                  ) : item.status === 'failed' ? (
                    <button
                      onClick={() => queueManager.reindexDocument(item.docId)}
                      className="px-2 py-1 rounded bg-rose-50 text-rose-700 hover:bg-rose-100 font-medium text-[11px] flex items-center gap-1 transition"
                    >
                      <RotateCw className="w-3 h-3" />
                      <span>Retry</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => queueManager.cancel(item.docId)}
                      className="p-1 rounded text-slate-400 hover:text-rose-600 transition"
                      title="Cancel"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
