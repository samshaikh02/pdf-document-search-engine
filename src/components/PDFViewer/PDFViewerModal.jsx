import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, RotateCw, 
  Download, Maximize2, Minimize2, Search, Loader2, AlertCircle, FileText, Cloud
} from 'lucide-react';
import { pdfjsLib } from '../../services/pdfWorker';
import { getDocument, getDocumentBlob, formatBytes } from '../../services/db';
import { getSignedPdfUrl, downloadCloudPdfBlob } from '../../services/cloudDb';
import { getSupabase } from '../../services/supabaseClient';

export default function PDFViewerModal({ docId, initialPage = 1, highlightQuery = '', storagePath = null, docName = null, onClose }) {
  const [docMeta, setDocMeta] = useState(null);
  const [pdfDoc, setPdfDoc] = useState(null);
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [numPages, setNumPages] = useState(0);
  const [zoom, setZoom] = useState(1.25);
  const [rotation, setRotation] = useState(0);
  const [loading, setLoading] = useState(true);
  const [rendering, setRendering] = useState(false);
  const [error, setError] = useState(null);
  const [inputPage, setInputPage] = useState(initialPage.toString());
  const [textHighlights, setTextHighlights] = useState([]);
  const [activeHighlightIndex, setActiveHighlightIndex] = useState(0);
  const [signedUrl, setSignedUrl] = useState(null);
  const [isCloudDoc, setIsCloudDoc] = useState(false);

  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const renderTaskRef = useRef(null);

  // Load PDF from Cloud Storage (Supabase) or Local Storage (IndexedDB)
  useEffect(() => {
    let isMounted = true;

    async function loadPdf() {
      try {
        setLoading(true);
        setError(null);

        let buffer = null;
        let meta = null;
        let effectiveStoragePath = storagePath;

        const supabase = getSupabase();

        // 1. Check if document is in PostgreSQL / Cloud Storage
        if (supabase && (typeof docId === 'string' || effectiveStoragePath)) {
          if (!effectiveStoragePath) {
            const { data: cloudDoc } = await supabase
              .from('documents')
              .select('*')
              .eq('id', docId)
              .single();
            if (cloudDoc) {
              effectiveStoragePath = cloudDoc.storage_path;
              meta = {
                id: cloudDoc.id,
                name: cloudDoc.name,
                size: Number(cloudDoc.size),
                storagePath: cloudDoc.storage_path
              };
            }
          } else {
            meta = { id: docId, name: docName || 'Document.pdf', storagePath: effectiveStoragePath };
          }

          if (effectiveStoragePath) {
            try {
              const url = await getSignedPdfUrl(effectiveStoragePath, 3600);
              const blob = await downloadCloudPdfBlob(effectiveStoragePath);
              buffer = await blob.arrayBuffer();
              if (isMounted) {
                setSignedUrl(url);
                setIsCloudDoc(true);
                if (meta) setDocMeta(meta);
              }
            } catch (cloudErr) {
              console.warn('Failed to load from cloud storage, checking local IndexedDB:', cloudErr);
            }
          }
        }

        // 2. Fallback to local IndexedDB
        if (!buffer) {
          const localMeta = await getDocument(docId);
          const localBlob = await getDocumentBlob(docId);

          if (!localMeta && !meta) {
            throw new Error('PDF file could not be loaded from cloud or local storage.');
          }

          if (isMounted && localMeta) {
            setDocMeta(localMeta);
          }

          if (localBlob) {
            buffer = await localBlob.arrayBuffer();
          }
        }

        if (!buffer) {
          throw new Error('Could not retrieve binary PDF content.');
        }

        const loadingTask = pdfjsLib.getDocument({
          data: buffer,
          cMapUrl: '/cmaps/',
          cMapPacked: true,
          standardFontDataUrl: '/standard_fonts/',
          enableXfa: false
        });

        const doc = await loadingTask.promise;
        if (isMounted) {
          setPdfDoc(doc);
          setNumPages(doc.numPages);
          const validInitialPage = Math.min(Math.max(1, initialPage), doc.numPages);
          setCurrentPage(validInitialPage);
          setInputPage(validInitialPage.toString());
          setLoading(false);
        }
      } catch (err) {
        console.error('Failed to load PDF in viewer:', err);
        if (isMounted) {
          setError(err.message || 'Error opening PDF');
          setLoading(false);
        }
      }
    }

    loadPdf();

    return () => {
      isMounted = false;
    };
  }, [docId, initialPage, storagePath, docName]);

  // Render current page onto canvas
  const renderPage = useCallback(async () => {
    if (!pdfDoc || !canvasRef.current || currentPage < 1) return;

    try {
      setRendering(true);

      // Cancel previous ongoing render task if any
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel();
        } catch (e) {
          // ignore cancel error
        }
      }

      const page = await pdfDoc.getPage(currentPage);
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d', { alpha: false });

      const dpr = window.devicePixelRatio || 1;
      const viewport = page.getViewport({ scale: zoom * dpr, rotation });

      // Match canvas internal resolution to high DPI
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);

      // CSS display size matches actual zoom
      canvas.style.width = `${Math.floor(viewport.width / dpr)}px`;
      canvas.style.height = `${Math.floor(viewport.height / dpr)}px`;

      const renderContext = {
        canvasContext: ctx,
        viewport: viewport
      };

      const renderTask = page.render(renderContext);
      renderTaskRef.current = renderTask;
      await renderTask.promise;

      // Extract text content and calculate text highlights coordinates if highlightQuery is given
      if (highlightQuery && highlightQuery.trim()) {
        try {
          const textContent = await page.getTextContent();
          const cleanQuery = highlightQuery.trim().toLowerCase();
          const highlights = [];

          textContent.items.forEach(item => {
            const strLower = item.str.toLowerCase();
            const matchIndex = strLower.indexOf(cleanQuery);
            if (matchIndex !== -1) {
              // Transform PDF coordinates [x, y, w, h] to canvas viewport coordinates
              const tx = pdfjsLib.Util.transform(viewport.transform, item.transform);
              const fontHeight = Math.sqrt(tx[2] * tx[2] + tx[3] * tx[3]);
              const fontWidth = Math.sqrt(tx[0] * tx[0] + tx[1] * tx[1]);
              
              // Scale to display CSS coordinates
              const x = tx[4] / dpr;
              const y = (tx[5] - fontHeight) / dpr;
              const width = (item.width * (fontWidth / (item.height || 10))) / dpr || 60;
              const height = fontHeight / dpr || 16;

              highlights.push({
                text: item.str,
                x,
                y,
                width: Math.max(width, 30),
                height: Math.max(height, 14)
              });
            }
          });

          setTextHighlights(highlights);
          setActiveHighlightIndex(0);
        } catch (err) {
          console.warn('Text highlight extraction warning:', err);
        }
      } else {
        setTextHighlights([]);
      }

      setRendering(false);
    } catch (err) {
      if (err.name !== 'RenderingCancelledException') {
        console.error('Error rendering page:', err);
      }
      setRendering(false);
    }
  }, [pdfDoc, currentPage, zoom, rotation, highlightQuery]);

  useEffect(() => {
    renderPage();
  }, [renderPage]);

  // Handle keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowRight' || e.key === 'PageDown') {
        goToNextPage();
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        goToPrevPage();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentPage, numPages, onClose]);

  const goToPrevPage = () => {
    if (currentPage > 1) {
      const next = currentPage - 1;
      setCurrentPage(next);
      setInputPage(next.toString());
    }
  };

  const goToNextPage = () => {
    if (currentPage < numPages) {
      const next = currentPage + 1;
      setCurrentPage(next);
      setInputPage(next.toString());
    }
  };

  const handlePageInputSubmit = (e) => {
    e.preventDefault();
    const p = parseInt(inputPage, 10);
    if (!isNaN(p) && p >= 1 && p <= numPages) {
      setCurrentPage(p);
    } else {
      setInputPage(currentPage.toString());
    }
  };

  const handleDownload = async () => {
    if (!docMeta) return;

    if (signedUrl) {
      const a = document.createElement('a');
      a.href = signedUrl;
      a.download = docMeta.name || 'document.pdf';
      a.target = '_blank';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      return;
    }

    const blob = await getDocumentBlob(docId);
    if (!blob) return;

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = docMeta.name || 'document.pdf';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-900/95 backdrop-blur-sm animate-fade-in text-slate-100">
      {/* Top Viewer Header Bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-800/90 border-b border-slate-700/80 shadow-md">
        {/* Document Info */}
        <div className="flex items-center space-x-3 overflow-hidden max-w-md">
          <div className="p-2 rounded-lg bg-indigo-500/20 text-indigo-400">
            <FileText className="w-5 h-5" />
          </div>
          <div className="truncate">
            <h3 className="text-sm font-semibold text-white truncate" title={docMeta?.name}>
              {docMeta?.name || 'Loading Document...'}
            </h3>
            <p className="text-xs text-slate-400">
              {docMeta ? `${formatBytes(docMeta.size)} • ${numPages} Pages` : ''}
              {highlightQuery && (
                <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  <Search className="w-2.5 h-2.5 mr-1" />
                  Query: "{highlightQuery}"
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Page Navigation & Controls */}
        <div className="flex items-center space-x-2">
          {/* Previous Page */}
          <button
            onClick={goToPrevPage}
            disabled={currentPage <= 1 || loading}
            className="p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed transition"
            title="Previous Page (Left Arrow)"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          {/* Page Indicator / Form */}
          <form onSubmit={handlePageInputSubmit} className="flex items-center space-x-1.5">
            <span className="text-xs text-slate-400">Page</span>
            <input
              type="text"
              value={inputPage}
              onChange={(e) => setInputPage(e.target.value)}
              onBlur={() => setInputPage(currentPage.toString())}
              className="w-12 px-2 py-1 text-xs text-center font-semibold bg-slate-900 border border-slate-600 rounded text-white focus:outline-none focus:border-indigo-500"
            />
            <span className="text-xs text-slate-400">of {numPages || 1}</span>
          </form>

          {/* Next Page */}
          <button
            onClick={goToNextPage}
            disabled={currentPage >= numPages || loading}
            className="p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed transition"
            title="Next Page (Right Arrow)"
          >
            <ChevronRight className="w-5 h-5" />
          </button>

          <div className="h-5 w-px bg-slate-700 mx-1" />

          {/* Zoom Out */}
          <button
            onClick={() => setZoom(z => Math.max(0.5, parseFloat((z - 0.2).toFixed(1))))}
            className="p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 transition"
            title="Zoom Out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>

          <span className="text-xs font-mono font-medium text-slate-300 w-12 text-center">
            {Math.round(zoom * 100)}%
          </span>

          {/* Zoom In */}
          <button
            onClick={() => setZoom(z => Math.min(3.0, parseFloat((z + 0.2).toFixed(1))))}
            className="p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 transition"
            title="Zoom In"
          >
            <ZoomIn className="w-4 h-4" />
          </button>

          {/* Rotate */}
          <button
            onClick={() => setRotation(r => (r + 90) % 360)}
            className="p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 transition"
            title="Rotate Clockwise"
          >
            <RotateCw className="w-4 h-4" />
          </button>

          <div className="h-5 w-px bg-slate-700 mx-1" />

          {/* Download Original PDF */}
          <button
            onClick={handleDownload}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-medium text-white transition"
            title="Download PDF file"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Download</span>
          </button>

          {/* Close Viewer */}
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-700 hover:bg-rose-600 transition text-slate-300 hover:text-white"
            title="Close Viewer (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Viewer Canvas Workspace */}
      <div 
        ref={containerRef}
        className="flex-1 overflow-auto p-4 md:p-8 flex justify-center items-start bg-slate-950/70"
      >
        {loading && (
          <div className="flex flex-col items-center justify-center p-12 text-slate-400">
            <Loader2 className="w-10 h-10 animate-spin text-indigo-500 mb-3" />
            <p className="text-sm font-medium">Opening PDF Document...</p>
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center justify-center p-8 bg-rose-950/50 border border-rose-800 rounded-xl max-w-md text-center text-rose-200">
            <AlertCircle className="w-10 h-10 text-rose-400 mb-2" />
            <h4 className="font-semibold text-white mb-1">Failed to Display PDF</h4>
            <p className="text-xs text-rose-300">{error}</p>
          </div>
        )}

        <div className={`relative inline-block shadow-2xl rounded-sm transition-opacity duration-200 ${loading || error ? 'hidden' : 'block'}`}>
          {/* PDF Page Canvas */}
          <canvas
            ref={canvasRef}
            className="block rounded-sm bg-white"
          />

          {/* Visual Highlight Overlay for Search Matches */}
          {textHighlights.length > 0 && textHighlights.map((hl, i) => (
            <div
              key={i}
              className={`absolute pointer-events-none rounded transition-all ${
                i === activeHighlightIndex
                  ? 'bg-amber-400/40 border-2 border-amber-500 shadow-lg'
                  : 'bg-yellow-300/30 border border-yellow-400/50'
              }`}
              style={{
                left: `${hl.x}px`,
                top: `${hl.y}px`,
                width: `${hl.width}px`,
                height: `${hl.height}px`
              }}
            />
          ))}

          {/* Page Rendering Spinner indicator */}
          {rendering && (
            <div className="absolute top-3 right-3 bg-slate-900/80 backdrop-blur-sm text-white px-2.5 py-1 rounded-full text-xs flex items-center space-x-1.5 shadow-md">
              <Loader2 className="w-3 h-3 animate-spin text-indigo-400" />
              <span>Rendering...</span>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Status / Match Bar */}
      {highlightQuery && (
        <div className="px-6 py-2 bg-slate-800/90 border-t border-slate-700/80 text-xs flex items-center justify-between text-slate-300">
          <div className="flex items-center space-x-2">
            <span className="font-medium text-amber-400">Search matches on this page:</span>
            <span className="px-2 py-0.5 rounded-full bg-slate-700 text-white font-mono">
              {textHighlights.length} match{textHighlights.length === 1 ? '' : 'es'} found
            </span>
          </div>
          <div className="text-slate-400 text-[11px]">
            Use Left / Right arrow keys to flip pages • Press Esc to close
          </div>
        </div>
      )}
    </div>
  );
}
