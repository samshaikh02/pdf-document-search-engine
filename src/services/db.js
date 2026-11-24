import Dexie from 'dexie';

export const db = new Dexie('DocuSearchDB');

// Version 1 of the schema
db.version(1).stores({
  // Metadata for documents
  documents: '++id, name, size, pageCount, uploadDate, indexStatus, ocrApplied',
  // Binary PDF blobs stored separately so listing documents never loads heavy binaries into RAM
  documentBlobs: 'docId',
  // Page-wise extracted text
  pages: '++id, docId, pageNumber, [docId+pageNumber], hasOcr',
  // Search history log
  searchHistory: '++id, query, timestamp',
  // Application settings
  settings: 'key'
});

/**
 * Default configurable limits & settings
 */
export const DEFAULT_SETTINGS = {
  maxDocumentCount: 500,        // 1. Up to 500 PDF documents (scalable to 1000-5000)
  maxFileSizeMB: 25,            // 2. Maximum individual PDF size: 25 MB
  storageBudgetGB: 2.0,         // 3. Suggested total storage budget: 2 GB
  maxSimultaneousUploads: 10,   // 4. Maximum simultaneous uploads: 10 files
  ocrConcurrency: 1,            // 5. OCR controlled batches: 1-2 PDFs
  ocrEnabled: true,
  ocrLanguages: 'eng+guj+hin',  // English, Gujarati, Hindi
  autoOcr: true,
  minCharsForOcr: 25,
  storageWarningThreshold: 80   // Warning at 80% of budget or quota
};

// Storage formatting utility
export function formatBytes(bytes, decimals = 2) {
  if (!bytes || bytes <= 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Get device storage usage and quota from browser, evaluated against configured budget
 */
export async function getStorageStats() {
  const settings = await getAllSettings();
  const maxDocs = settings.maxDocumentCount || DEFAULT_SETTINGS.maxDocumentCount;
  const budgetBytes = (settings.storageBudgetGB || DEFAULT_SETTINGS.storageBudgetGB) * 1024 * 1024 * 1024;
  const warningPercent = settings.storageWarningThreshold || 80;

  let currentDocCount = 0;
  try {
    currentDocCount = await db.documents.count();
  } catch (e) {
    // ignore
  }

  let usage = 0;
  let browserQuota = 0;

  if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.estimate) {
    try {
      const estimate = await navigator.storage.estimate();
      usage = estimate.usage || 0;
      browserQuota = estimate.quota || 0;
    } catch (err) {
      console.warn('Storage estimate failed:', err);
    }
  }

  // If storage estimate returns 0 (e.g. some private modes or node test), estimate from DB
  if (usage === 0) {
    try {
      const allDocs = await db.documents.toArray();
      usage = allDocs.reduce((acc, d) => acc + (d.size || 0), 0);
    } catch (e) {}
  }

  // Effective quota is the lower of the browser's actual quota and the user-configured budget
  // This ensures we never assume the browser can hold 2 GB if actual disk space or browser quota is lower!
  let effectiveQuota = budgetBytes;
  if (browserQuota > 0) {
    effectiveQuota = Math.min(browserQuota, budgetBytes);
  }

  const availableStorage = Math.max(0, effectiveQuota - usage);
  const browserFreeStorage = browserQuota > 0 ? Math.max(0, browserQuota - usage) : availableStorage;
  const usagePercent = effectiveQuota > 0 ? Math.min(100, parseFloat(((usage / effectiveQuota) * 100).toFixed(1))) : 0;
  const remainingDocCapacity = Math.max(0, maxDocs - currentDocCount);

  const isStorageWarning = usagePercent >= warningPercent;
  const isStorageCritical = usagePercent >= 95 || (effectiveQuota > 0 && availableStorage < 30 * 1024 * 1024);
  const isDocLimitWarning = currentDocCount >= (maxDocs * 0.9);
  const isDocLimitReached = currentDocCount >= maxDocs;

  let warningMessage = null;
  if (isStorageCritical) {
    warningMessage = `Critical Storage Warning: Storage is at ${usagePercent}%. Only ${formatBytes(availableStorage)} remaining. Delete documents to prevent storage failure.`;
  } else if (isStorageWarning) {
    warningMessage = `Storage Warning: Used ${usagePercent}% of the ${formatBytes(effectiveQuota)} storage limit (${formatBytes(availableStorage)} remaining).`;
  } else if (isDocLimitReached) {
    warningMessage = `Document Capacity Reached: Document collection has reached maximum capacity (${maxDocs} documents).`;
  } else if (isDocLimitWarning) {
    warningMessage = `Document Capacity Warning: Document collection approaching limit (${currentDocCount}/${maxDocs} documents).`;
  }

  return {
    usage,
    browserQuota,
    budgetBytes,
    effectiveQuota,
    availableStorage,
    browserFreeStorage,
    usagePercent,
    currentDocCount,
    maxDocs,
    remainingDocCapacity,
    isStorageWarning,
    isStorageCritical,
    isDocLimitWarning,
    isDocLimitReached,
    warningMessage,
    formattedUsage: formatBytes(usage),
    formattedQuota: formatBytes(effectiveQuota),
    formattedAvailable: formatBytes(availableStorage),
    formattedBrowserQuota: browserQuota > 0 ? formatBytes(browserQuota) : 'Unknown'
  };
}

/**
 * Save new document metadata and its original PDF blob
 */
export async function saveDocumentRecord({ file, pageCount = 0 }) {
  return await db.transaction('rw', db.documents, db.documentBlobs, async () => {
    const docId = await db.documents.add({
      name: file.name,
      size: file.size,
      type: file.type || 'application/pdf',
      pageCount: pageCount,
      uploadDate: Date.now(),
      indexStatus: 'pending', // pending, processing, indexed, failed, ocr_processing
      ocrApplied: false,
      ocrPageCount: 0,
      extractedWordsCount: 0,
      error: null
    });

    // Store binary blob separately
    await db.documentBlobs.put({
      docId: docId,
      blob: file
    });

    return docId;
  });
}

/**
 * Save or update extracted page text for a document
 */
export async function savePageTextRecord({ docId, pageNumber, text, hasOcr = false }) {
  // Check if page record already exists
  const existing = await db.pages.where({ docId, pageNumber }).first();
  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;

  if (existing) {
    await db.pages.update(existing.id, {
      text,
      hasOcr,
      wordCount
    });
  } else {
    await db.pages.add({
      docId,
      pageNumber,
      text,
      hasOcr,
      wordCount
    });
  }
}

/**
 * Update document status and fields
 */
export async function updateDocStatus(docId, status, extra = {}) {
  await db.documents.update(docId, {
    indexStatus: status,
    ...extra
  });
}

/**
 * Retrieve document metadata by ID
 */
export async function getDocument(docId) {
  return await db.documents.get(Number(docId));
}

/**
 * Retrieve original PDF Blob by doc ID
 */
export async function getDocumentBlob(docId) {
  const record = await db.documentBlobs.get(Number(docId));
  return record ? record.blob : null;
}

/**
 * Retrieve all pages for a document
 */
export async function getDocumentPages(docId) {
  return await db.pages.where('docId').equals(Number(docId)).sortBy('pageNumber');
}

/**
 * Delete a document, its binary blob, and all its pages
 */
export async function deleteDocument(docId) {
  const id = Number(docId);
  return await db.transaction('rw', db.documents, db.documentBlobs, db.pages, async () => {
    await db.documents.delete(id);
    await db.documentBlobs.delete(id);
    await db.pages.where('docId').equals(id).delete();
  });
}

/**
 * Clear all data from the database
 */
export async function clearAllData() {
  await db.transaction('rw', db.documents, db.documentBlobs, db.pages, db.searchHistory, async () => {
    await db.documents.clear();
    await db.documentBlobs.clear();
    await db.pages.clear();
    await db.searchHistory.clear();
  });
}

/**
 * Search history methods
 */
export async function addSearchHistory(query, matchCount = 0, docCount = 0) {
  if (!query || !query.trim()) return;
  const trimmed = query.trim();

  // Avoid consecutive duplicates
  const latest = await db.searchHistory.orderBy('timestamp').reverse().first();
  if (latest && latest.query.toLowerCase() === trimmed.toLowerCase()) {
    await db.searchHistory.update(latest.id, {
      timestamp: Date.now(),
      matchCount,
      docCount
    });
    return;
  }

  await db.searchHistory.add({
    query: trimmed,
    timestamp: Date.now(),
    matchCount,
    docCount
  });
}

export async function getSearchHistory(limit = 30) {
  return await db.searchHistory.orderBy('timestamp').reverse().limit(limit).toArray();
}

export async function deleteSearchHistoryItem(id) {
  await db.searchHistory.delete(Number(id));
}

export async function clearSearchHistory() {
  await db.searchHistory.clear();
}

/**
 * Settings helpers
 */
export async function getSetting(key, fallback = null) {
  const record = await db.settings.get(key);
  if (record !== undefined) return record.value;
  return fallback !== null ? fallback : DEFAULT_SETTINGS[key];
}

export async function getAllSettings() {
  const all = await db.settings.toArray();
  const settingsObj = { ...DEFAULT_SETTINGS };
  all.forEach(item => {
    settingsObj[item.key] = item.value;
  });
  return settingsObj;
}

export async function setSetting(key, value) {
  await db.settings.put({ key, value });
}

/**
 * Validate files against upload capacity, size limits, and available storage
 */
export async function validateUploadBatch(files) {
  const settings = await getAllSettings();
  const maxDocs = settings.maxDocumentCount || DEFAULT_SETTINGS.maxDocumentCount;
  const maxFileSizeMB = settings.maxFileSizeMB || DEFAULT_SETTINGS.maxFileSizeMB;
  const maxFileSizeBytes = maxFileSizeMB * 1024 * 1024;
  const maxSimultaneous = settings.maxSimultaneousUploads || DEFAULT_SETTINGS.maxSimultaneousUploads;

  const stats = await getStorageStats();
  const fileArray = Array.from(files || []);

  const errors = [];
  const validFiles = [];

  // Check 1: Empty selection
  if (fileArray.length === 0) {
    return {
      isValid: false,
      errors: ['No files selected.'],
      validFiles: []
    };
  }

  // Check 2: Max document count limit
  const currentCount = stats.currentDocCount;
  const availableSlots = Math.max(0, maxDocs - currentCount);

  if (availableSlots <= 0) {
    return {
      isValid: false,
      errors: [`Document capacity limit reached (${maxDocs} documents). Delete existing documents to upload new ones.`],
      validFiles: []
    };
  }

  // Check 3: Max simultaneous upload batch limit
  if (fileArray.length > maxSimultaneous) {
    errors.push(`Upload batch limited to maximum ${maxSimultaneous} simultaneous files. The first ${maxSimultaneous} files will be queued.`);
  }

  const filesToConsider = fileArray.slice(0, Math.min(fileArray.length, maxSimultaneous, availableSlots));

  if (fileArray.length > availableSlots && availableSlots < maxSimultaneous) {
    errors.push(`Only ${availableSlots} document slot(s) remaining (maximum capacity: ${maxDocs}).`);
  }

  let totalBatchBytes = 0;

  for (const file of filesToConsider) {
    // Check PDF type
    const isPdf = file.name.toLowerCase().endsWith('.pdf') || file.type === 'application/pdf';
    if (!isPdf) {
      errors.push(`"${file.name}" is not a PDF file and was skipped.`);
      continue;
    }

    // Check individual file size limit (default 25 MB)
    if (file.size > maxFileSizeBytes) {
      errors.push(`"${file.name}" exceeds maximum allowed file size of ${maxFileSizeMB} MB (${formatBytes(file.size)}).`);
      continue;
    }

    totalBatchBytes += file.size;
    validFiles.push(file);
  }

  // Check 4: Available storage capacity check
  if (validFiles.length > 0 && stats.availableStorage < totalBatchBytes) {
    return {
      isValid: false,
      errors: [
        `Insufficient storage: Uploading ${formatBytes(totalBatchBytes)} exceeds available storage (${formatBytes(stats.availableStorage)}). Delete existing documents to free up space.`
      ],
      validFiles: []
    };
  }

  return {
    isValid: validFiles.length > 0,
    errors,
    validFiles,
    totalBatchBytes,
    formattedBatchBytes: formatBytes(totalBatchBytes)
  };
}
