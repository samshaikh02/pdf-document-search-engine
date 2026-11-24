import { getSupabase } from './supabaseClient.js';
import { formatBytes, DEFAULT_SETTINGS } from './db.js';

const BUCKET_NAME = 'pdf-documents';

/**
 * Upload a PDF file to Supabase Storage and register its PostgreSQL document record
 */
export async function uploadDocumentToCloud({ file, userId = 'public' }) {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase client is not connected.');

  // Clean filename for safe cloud storage path
  const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const userFolder = userId && userId !== 'public' ? userId : 'shared';
  const storagePath = `${userFolder}/${Date.now()}_${sanitizedName}`;

  // 1. Upload original binary PDF to Supabase Storage
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(storagePath, file, {
      contentType: file.type || 'application/pdf',
      cacheControl: '3600',
      upsert: false
    });

  if (uploadError) {
    console.error('Supabase storage upload error:', uploadError);
    throw new Error(`Cloud storage upload failed: ${uploadError.message}`);
  }

  // 2. Insert document record in PostgreSQL
  const { data: docData, error: docError } = await supabase
    .from('documents')
    .insert([
      {
        user_id: userId || 'public',
        name: file.name,
        size: file.size,
        type: file.type || 'application/pdf',
        page_count: 0,
        storage_path: storagePath,
        index_status: 'pending',
        ocr_applied: false,
        ocr_page_count: 0,
        extracted_words_count: 0,
        error: null
      }
    ])
    .select()
    .single();

  if (docError) {
    // Cleanup orphaned storage file if DB insert fails
    await supabase.storage.from(BUCKET_NAME).remove([storagePath]);
    throw new Error(`Database registration failed: ${docError.message}`);
  }

  return {
    doc: docData,
    storagePath
  };
}

/**
 * Update document status in PostgreSQL
 */
export async function updateCloudDocStatus(docId, status, extra = {}) {
  const supabase = getSupabase();
  if (!supabase) return;

  const updatePayload = {
    index_status: status,
    updated_at: new Date().toISOString(),
    ...extra
  };

  const { error } = await supabase
    .from('documents')
    .update(updatePayload)
    .eq('id', docId);

  if (error) {
    console.error(`Failed to update status for document ${docId}:`, error);
  }
}

/**
 * Save page text record in PostgreSQL (page-by-page)
 */
export async function saveCloudPageText({ docId, userId = 'public', pageNumber, text, hasOcr = false }) {
  const supabase = getSupabase();
  if (!supabase) return;

  const wordCount = text?.trim() ? text.trim().split(/\s+/).length : 0;

  const { error } = await supabase
    .from('document_pages')
    .upsert(
      {
        user_id: userId || 'public',
        document_id: docId,
        page_number: pageNumber,
        text: text || '',
        word_count: wordCount,
        has_ocr: hasOcr
      },
      { onConflict: 'document_id,page_number' }
    );

  if (error) {
    console.error(`Error saving page ${pageNumber} for doc ${docId}:`, error);
  }
}

/**
 * Fetch all documents from PostgreSQL (publicly shared across devices)
 */
export async function fetchCloudDocuments(userId) {
  const supabase = getSupabase();
  if (!supabase) return [];

  let query = supabase
    .from('documents')
    .select('*')
    .order('created_at', { ascending: false });

  if (userId && userId !== 'public') {
    query = query.eq('user_id', userId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching cloud documents:', error);
    return [];
  }

  return (data || []).map(d => ({
    id: d.id,
    name: d.name,
    size: Number(d.size),
    type: d.type,
    pageCount: d.page_count,
    storagePath: d.storage_path,
    uploadDate: new Date(d.upload_date || d.created_at).getTime(),
    indexStatus: d.index_status,
    ocrApplied: d.ocr_applied,
    ocrPageCount: d.ocr_page_count,
    extractedWordsCount: d.extracted_words_count,
    error: d.error
  }));
}

/**
 * Fetch pages for a document
 */
export async function fetchCloudDocumentPages(docId) {
  const supabase = getSupabase();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('document_pages')
    .select('*')
    .eq('document_id', docId)
    .order('page_number', { ascending: true });

  if (error) {
    console.error(`Error fetching pages for doc ${docId}:`, error);
    return [];
  }

  return data.map(p => ({
    id: p.id,
    docId: p.document_id,
    pageNumber: p.page_number,
    text: p.text,
    wordCount: p.word_count,
    hasOcr: p.has_ocr
  }));
}

/**
 * Delete document from PostgreSQL and remove binary PDF from cloud storage
 */
export async function deleteCloudDocument(docId, storagePath) {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase is not connected.');

  // 1. Delete from PostgreSQL documents table (cascades to document_pages)
  const { error: dbError } = await supabase
    .from('documents')
    .delete()
    .eq('id', docId);

  if (dbError) throw dbError;

  // 2. Remove original PDF file from Cloud Storage
  if (storagePath) {
    const { error: storageError } = await supabase.storage
      .from(BUCKET_NAME)
      .remove([storagePath]);

    if (storageError) {
      console.warn('Storage deletion warning:', storageError);
    }
  }
}

/**
 * Create a secure signed download/view URL for a PDF file
 */
export async function getSignedPdfUrl(storagePath, expiresIn = 3600) {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase client is not available.');

  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .createSignedUrl(storagePath, expiresIn);

  if (error) throw error;
  return data.signedUrl;
}

/**
 * Download original PDF Blob from Supabase storage into memory
 */
export async function downloadCloudPdfBlob(storagePath) {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase client is not available.');

  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .download(storagePath);

  if (error) throw error;
  return data;
}

/**
 * Calculate cloud storage metrics for user against configured budget
 */
export async function getCloudStorageStats(userId) {
  const docs = await fetchCloudDocuments(userId);
  const currentDocCount = docs.length;
  const maxDocs = DEFAULT_SETTINGS.maxDocumentCount;
  const budgetBytes = DEFAULT_SETTINGS.storageBudgetGB * 1024 * 1024 * 1024; // 2 GB

  const totalUsedBytes = docs.reduce((acc, d) => acc + (d.size || 0), 0);
  const availableStorage = Math.max(0, budgetBytes - totalUsedBytes);
  const usagePercent = budgetBytes > 0 ? Math.min(100, parseFloat(((totalUsedBytes / budgetBytes) * 100).toFixed(1))) : 0;
  const remainingDocCapacity = Math.max(0, maxDocs - currentDocCount);

  const isStorageWarning = usagePercent >= 80;
  const isStorageCritical = usagePercent >= 95 || availableStorage < (50 * 1024 * 1024);
  const isDocLimitReached = currentDocCount >= maxDocs;
  const isDocLimitWarning = currentDocCount >= (maxDocs * 0.9);

  let warningMessage = null;
  if (isStorageCritical) {
    warningMessage = `Cloud Storage Critical: ${usagePercent}% of your 2.0 GB budget is used (${formatBytes(availableStorage)} remaining). Delete documents to free space.`;
  } else if (isStorageWarning) {
    warningMessage = `Cloud Storage Warning: Storage is at ${usagePercent}% capacity (${formatBytes(availableStorage)} remaining).`;
  } else if (isDocLimitReached) {
    warningMessage = `Document Limit Reached: Cloud library reached the ${maxDocs} PDF document limit.`;
  } else if (isDocLimitWarning) {
    warningMessage = `Document Capacity Notice: Approaching limit (${currentDocCount}/${maxDocs} documents).`;
  }

  return {
    usage: totalUsedBytes,
    effectiveQuota: budgetBytes,
    availableStorage,
    usagePercent,
    currentDocCount,
    maxDocs,
    remainingDocCapacity,
    isStorageWarning,
    isStorageCritical,
    isDocLimitWarning,
    isDocLimitReached,
    warningMessage,
    formattedUsage: formatBytes(totalUsedBytes),
    formattedQuota: formatBytes(budgetBytes),
    formattedAvailable: formatBytes(availableStorage),
    formattedBrowserQuota: '2.00 GB Cloud Target'
  };
}

/**
 * Realtime subscription to documents table
 * Instantly synchronizes changes across PC 1, PC 2, laptop, and different browsers!
 */
export function subscribeToCloudDocuments(arg1, arg2) {
  const supabase = getSupabase();
  if (!supabase) return () => {};

  const onUpdate = typeof arg1 === 'function' ? arg1 : arg2;
  if (!onUpdate) return () => {};

  const channel = supabase
    .channel('realtime:public:documents')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'documents'
      },
      (payload) => {
        onUpdate(payload);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

/**
 * Cloud Search History methods
 */
export async function addCloudSearchHistory(query, matchCount, docCount, userId = 'public') {
  const supabase = getSupabase();
  if (!supabase || !query?.trim()) return;

  await supabase
    .from('search_history')
    .insert([
      {
        user_id: userId || 'public',
        query: query.trim(),
        match_count: matchCount,
        doc_count: docCount
      }
    ]);
}

export async function fetchCloudSearchHistory(userId, limit = 50) {
  const supabase = getSupabase();
  if (!supabase) return [];

  let queryBuilder = supabase
    .from('search_history')
    .select('*')
    .order('timestamp', { ascending: false })
    .limit(limit);

  if (userId && userId !== 'public') {
    queryBuilder = queryBuilder.eq('user_id', userId);
  }

  const { data, error } = await queryBuilder;

  if (error) {
    console.warn('Error fetching search history:', error);
    return [];
  }

  return (data || []).map(h => ({
    id: h.id,
    query: h.query,
    timestamp: new Date(h.timestamp).getTime(),
    matchCount: h.match_count,
    docCount: h.doc_count
  }));
}

export async function deleteCloudSearchHistoryItem(id) {
  const supabase = getSupabase();
  if (!supabase) return;

  await supabase
    .from('search_history')
    .delete()
    .eq('id', id);
}

export async function clearCloudSearchHistory(userId) {
  const supabase = getSupabase();
  if (!supabase) return;

  let queryBuilder = supabase.from('search_history').delete();
  if (userId && userId !== 'public') {
    queryBuilder = queryBuilder.eq('user_id', userId);
  } else {
    queryBuilder = queryBuilder.neq('id', '00000000-0000-0000-0000-000000000000');
  }

  await queryBuilder;
}
