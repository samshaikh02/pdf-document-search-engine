import { 
  saveDocumentRecord, 
  getDocument, 
  getDocumentBlob, 
  updateDocStatus,
  getSetting,
  validateUploadBatch 
} from './db.js';
import { processDocumentText } from './pdfExtractor.js';
import { 
  uploadDocumentToCloud, 
  downloadCloudPdfBlob 
} from './cloudDb.js';
import { getCurrentUser } from './authService.js';
import { isSupabaseConfigured } from './supabaseClient.js';

class ProcessingQueueManager {
  constructor() {
    this.queue = [];
    this.activeWorkers = 0;
    this.maxConcurrency = 1; // Controlled concurrency (1-2) to prevent memory exhaustion
    this.isPaused = false;
    this.subscribers = new Set();
    this.activeControllers = new Map(); // docId -> AbortController
    this.lastValidationErrors = [];
  }

  subscribe(callback) {
    this.subscribers.add(callback);
    callback(this.getState());
    return () => this.subscribers.delete(callback);
  }

  notify() {
    const state = this.getState();
    this.subscribers.forEach(cb => {
      try {
        cb(state);
      } catch (e) {
        console.error('Queue subscriber error:', e);
      }
    });
  }

  getState() {
    return {
      queue: [...this.queue],
      isProcessing: this.activeWorkers > 0,
      isPaused: this.isPaused,
      activeWorkers: this.activeWorkers,
      maxConcurrency: this.maxConcurrency,
      lastValidationErrors: this.lastValidationErrors,
      totalPending: this.queue.filter(i => i.status === 'pending').length,
      totalProcessing: this.queue.filter(i => i.status === 'processing').length,
      totalCompleted: this.queue.filter(i => i.status === 'completed').length,
      totalFailed: this.queue.filter(i => i.status === 'failed').length
    };
  }

  /**
   * Validate files against size, capacity and storage limits, then queue valid PDFs
   */
  async addFiles(files, onFileAdded = () => {}) {
    // 1. Run full validation (document capacity, 25MB individual limit, 2GB budget, 10 simultaneous upload limit)
    const validation = await validateUploadBatch(files);
    this.lastValidationErrors = validation.errors || [];

    if (!validation.isValid && validation.validFiles.length === 0) {
      this.notify();
      return {
        success: false,
        queuedCount: 0,
        errors: validation.errors
      };
    }

    const isCloud = isSupabaseConfigured();
    const newItems = [];

    for (const file of validation.validFiles) {
      try {
        let docId;
        let storagePath = null;

        if (isCloud) {
          // Upload to Supabase Storage and register PostgreSQL document record (public shared mode)
          const cloudResult = await uploadDocumentToCloud({ file, userId: 'public' });
          docId = cloudResult.doc.id;
          storagePath = cloudResult.storagePath;
        } else {
          // Local IndexedDB mode
          docId = await saveDocumentRecord({ file, pageCount: 0 });
        }

        const queueItem = {
          id: `queue-${docId}-${Date.now()}`,
          docId,
          name: file.name,
          size: file.size,
          storagePath,
          isCloud,
          userId: 'public',
          cachedBlob: file, // Keep in memory so current session processes without re-downloading
          status: 'pending', // pending, processing, completed, failed
          progress: 0,
          page: 0,
          totalPages: 0,
          stage: 'queued',
          message: isCloud ? 'Uploaded to Cloud Storage. Queued for indexing.' : 'Queued for processing',
          error: null,
          startTime: null,
          endTime: null
        };

        this.queue.push(queueItem);
        newItems.push(queueItem);
        onFileAdded(queueItem);
      } catch (err) {
        console.error(`Failed to stage file ${file.name}:`, err);
        this.lastValidationErrors.push(`Failed to save "${file.name}" to storage: ${err.message}`);
      }
    }

    this.notify();
    this.processNext();

    return {
      success: newItems.length > 0,
      queuedCount: newItems.length,
      errors: validation.errors,
      newItems
    };
  }

  /**
   * Queue an existing document in IndexedDB for re-indexing
   */
  async reindexDocument(docId) {
    const doc = await getDocument(docId);
    if (!doc) throw new Error('Document not found');

    // Remove existing item from queue if any
    this.queue = this.queue.filter(i => i.docId !== docId);

    const queueItem = {
      id: `queue-${docId}-${Date.now()}`,
      docId,
      name: doc.name,
      size: doc.size,
      status: 'pending',
      progress: 0,
      page: 0,
      totalPages: 0,
      stage: 'queued',
      message: 'Re-indexing queued',
      error: null,
      startTime: null,
      endTime: null
    };

    this.queue.unshift(queueItem); // Put at top of queue
    await updateDocStatus(docId, 'pending');
    this.notify();
    this.processNext();
    return queueItem;
  }

  /**
   * Run the next items in queue according to controlled concurrency (1-2 PDFs)
   */
  async processNext() {
    if (this.isPaused) return;

    // Refresh dynamic concurrency setting (1-2 controlled batches)
    try {
      const concurrencySetting = await getSetting('ocrConcurrency', 1);
      // Strictly clamp between 1 and 2 to honor requirement #5
      this.maxConcurrency = Math.min(2, Math.max(1, parseInt(concurrencySetting, 10) || 1));
    } catch (e) {
      this.maxConcurrency = 1;
    }

    if (this.activeWorkers >= this.maxConcurrency) return;

    const nextItem = this.queue.find(item => item.status === 'pending');
    if (!nextItem) return;

    nextItem.status = 'processing';
    nextItem.startTime = Date.now();
    nextItem.stage = 'starting';
    nextItem.message = 'Starting extraction...';
    this.activeWorkers++;
    this.notify();

    const abortController = new AbortController();
    this.activeControllers.set(nextItem.docId, abortController);

    try {
      // Yield to event loop before heavy work starts so browser stays responsive
      await new Promise(r => setTimeout(r, 20));

      let doc = null;
      let blob = null;

      if (nextItem.isCloud) {
        doc = {
          id: nextItem.docId,
          name: nextItem.name,
          storagePath: nextItem.storagePath,
          userId: nextItem.userId
        };
        blob = nextItem.cachedBlob;
        if (!blob && nextItem.storagePath) {
          blob = await downloadCloudPdfBlob(nextItem.storagePath);
        }
      } else {
        doc = await getDocument(nextItem.docId);
        blob = await getDocumentBlob(nextItem.docId);
      }

      if (!doc || !blob) {
        throw new Error('Document record or file data missing in storage');
      }

      const result = await processDocumentText({
        doc,
        fileBlob: blob,
        abortSignal: abortController.signal,
        onProgress: (p) => {
          nextItem.page = p.page;
          nextItem.totalPages = p.totalPages;
          nextItem.stage = p.stage;
          nextItem.message = p.message;
          if (p.totalPages > 0) {
            nextItem.progress = Math.round((p.page / p.totalPages) * 100);
          }
          this.notify();
        }
      });

      if (result.success) {
        nextItem.status = 'completed';
        nextItem.progress = 100;
        nextItem.page = result.pageCount;
        nextItem.totalPages = result.pageCount;
        nextItem.stage = 'completed';
        nextItem.message = `Indexed ${result.pageCount} pages (${result.totalWords} words)`;
        nextItem.endTime = Date.now();
      } else {
        nextItem.status = result.isCancelled ? 'pending' : 'failed';
        nextItem.stage = result.isCancelled ? 'cancelled' : 'error';
        nextItem.message = result.error || 'Extraction failed';
        nextItem.error = result.error;
      }
    } catch (err) {
      nextItem.status = 'failed';
      nextItem.stage = 'error';
      nextItem.message = err.message || 'Processing encountered error';
      nextItem.error = err.message;
    } finally {
      this.activeControllers.delete(nextItem.docId);
      this.activeWorkers--;
      this.notify();

      // Yield briefly before starting next job so UI paint stays 60fps
      await new Promise(r => setTimeout(r, 30));
      // Continue queue
      this.processNext();
    }
  }

  cancel(docId) {
    const controller = this.activeControllers.get(docId);
    if (controller) {
      controller.abort();
    }
    const item = this.queue.find(i => i.docId === docId);
    if (item && item.status === 'pending') {
      item.status = 'failed';
      item.message = 'Cancelled before start';
    }
    this.notify();
  }

  pause() {
    this.isPaused = true;
    this.notify();
  }

  resume() {
    this.isPaused = false;
    this.notify();
    this.processNext();
  }

  clearCompleted() {
    this.queue = this.queue.filter(i => i.status !== 'completed');
    this.notify();
  }

  clearAll() {
    // Abort all active
    this.activeControllers.forEach(ctrl => ctrl.abort());
    this.activeControllers.clear();
    this.queue = [];
    this.activeWorkers = 0;
    this.lastValidationErrors = [];
    this.notify();
  }
}

export const queueManager = new ProcessingQueueManager();
