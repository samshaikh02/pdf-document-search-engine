import { db, addSearchHistory } from './db.js';
import { getSupabase, isSupabaseConfigured } from './supabaseClient.js';
import { getCurrentUser } from './authService.js';
import { addCloudSearchHistory } from './cloudDb.js';

/**
 * Escape regular expression special characters
 */
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Generate contextual snippet around matched character offset
 */
function createSnippet(text, matchStart, matchLength, padding = 70) {
  const start = Math.max(0, matchStart - padding);
  const end = Math.min(text.length, matchStart + matchLength + padding);

  let before = text.slice(start, matchStart);
  let match = text.slice(matchStart, matchStart + matchLength);
  let after = text.slice(matchStart + matchLength, end);

  // Clean up boundaries so we don't start/end in the middle of a word if possible
  if (start > 0) {
    const firstSpace = before.indexOf(' ');
    if (firstSpace !== -1 && firstSpace < 20) {
      before = '...' + before.slice(firstSpace + 1);
    } else {
      before = '...' + before;
    }
  }

  if (end < text.length) {
    const lastSpace = after.lastIndexOf(' ');
    if (lastSpace !== -1 && lastSpace > after.length - 20) {
      after = after.slice(0, lastSpace) + '...';
    } else {
      after = after + '...';
    }
  }

  return {
    before,
    match,
    after,
    fullSnippet: `${before}${match}${after}`,
    charOffset: matchStart
  };
}

/**
 * Execute search across cloud PostgreSQL database
 */
async function searchCloudDocuments(query, options, userId) {
  const startTime = performance.now();
  const supabase = getSupabase();
  const trimmed = (query || '').trim();

  const {
    exactPhrase = false,
    matchAllWords = true,
    caseSensitive = false
  } = options;

  const normalizedQuery = trimmed.normalize('NFC');
  const regexFlags = caseSensitive ? 'gu' : 'giu';
  let searchRegex;
  let wordRegexes = [];

  const tokens = normalizedQuery.split(/\s+/).filter(t => t.length > 0);

  if (exactPhrase) {
    searchRegex = new RegExp(escapeRegExp(normalizedQuery), regexFlags);
  } else if (tokens.length === 1) {
    searchRegex = new RegExp(escapeRegExp(tokens[0]), regexFlags);
  } else {
    wordRegexes = tokens.map(t => new RegExp(escapeRegExp(t), regexFlags));
    const combinedPattern = tokens.map(t => escapeRegExp(t)).join('|');
    searchRegex = new RegExp(combinedPattern, regexFlags);
  }

  // 1. Query pages from PostgreSQL joining documents
  // Using ilike on first token for database-level pre-filtering
  let queryBuilder = supabase
    .from('document_pages')
    .select(`
      id,
      page_number,
      text,
      has_ocr,
      document:documents!inner (
        id,
        name,
        size,
        type,
        page_count,
        storage_path,
        upload_date,
        index_status,
        ocr_applied
      )
    `)
    .eq('documents.index_status', 'indexed');

  if (userId && userId !== 'public') {
    queryBuilder = queryBuilder.eq('user_id', userId);
  }

  // If we have search tokens, filter candidate pages
  if (tokens.length > 0) {
    queryBuilder = queryBuilder.ilike('text', `%${tokens[0]}%`);
  }

  const { data: matchedPages, error } = await queryBuilder;

  if (error) {
    console.error('Cloud search query error:', error);
    throw error;
  }

  const matchedDocsMap = new Map();
  let totalGlobalMatches = 0;

  for (const row of (matchedPages || [])) {
    const docMeta = row.document;
    if (!docMeta) continue;

    const pageText = (row.text || '').normalize('NFC');
    if (!pageText) continue;

    let isMatch = false;

    if (exactPhrase || wordRegexes.length === 0) {
      searchRegex.lastIndex = 0;
      isMatch = searchRegex.test(pageText);
    } else if (matchAllWords) {
      isMatch = wordRegexes.every(rx => {
        rx.lastIndex = 0;
        return rx.test(pageText);
      });
    } else {
      isMatch = wordRegexes.some(rx => {
        rx.lastIndex = 0;
        return rx.test(pageText);
      });
    }

    if (!isMatch) continue;

    // Find occurrences and extract snippets
    searchRegex.lastIndex = 0;
    const snippets = [];
    let match;
    let occurrencesOnPage = 0;

    while ((match = searchRegex.exec(pageText)) !== null) {
      occurrencesOnPage++;
      if (snippets.length < 5) {
        snippets.push(createSnippet(pageText, match.index, match[0].length));
      }
      if (match.index === searchRegex.lastIndex) {
        searchRegex.lastIndex++;
      }
    }

    if (occurrencesOnPage === 0) continue;

    totalGlobalMatches += occurrencesOnPage;

    if (!matchedDocsMap.has(docMeta.id)) {
      let score = 0;
      const docNameLower = (docMeta.name || '').toLowerCase();
      const queryLower = normalizedQuery.toLowerCase();
      if (docNameLower.includes(queryLower)) {
        score += 100;
      }

      matchedDocsMap.set(docMeta.id, {
        docId: docMeta.id,
        name: docMeta.name,
        size: Number(docMeta.size),
        storagePath: docMeta.storage_path,
        uploadDate: new Date(docMeta.upload_date).getTime(),
        pageCount: docMeta.page_count,
        ocrApplied: docMeta.ocr_applied,
        totalOccurrences: 0,
        relevanceScore: score,
        pages: []
      });
    }

    const docResult = matchedDocsMap.get(docMeta.id);
    docResult.totalOccurrences += occurrencesOnPage;
    docResult.relevanceScore += (occurrencesOnPage * 10) + 20;

    docResult.pages.push({
      pageNumber: row.page_number,
      hasOcr: row.has_ocr,
      occurrencesCount: occurrencesOnPage,
      snippets
    });
  }

  // Sort pages inside each document
  matchedDocsMap.forEach(docResult => {
    docResult.pages.sort((a, b) => a.pageNumber - b.pageNumber);
  });

  const results = Array.from(matchedDocsMap.values()).sort(
    (a, b) => b.relevanceScore - a.relevanceScore
  );

  const endTime = performance.now();
  const searchTimeMs = Math.round(endTime - startTime);

  // Record in cloud search history
  if (trimmed.length >= 2) {
    try {
      await addCloudSearchHistory(trimmed, totalGlobalMatches, results.length, userId);
    } catch (e) {
      console.warn('Failed to record cloud search history:', e);
    }
  }

  return {
    query: trimmed,
    searchTimeMs,
    totalMatches: totalGlobalMatches,
    totalDocumentsMatched: results.length,
    results
  };
}

/**
 * Global search across all indexed documents and pages
 * Automatically chooses Cloud Search (when authenticated) or Local IndexedDB
 * 
 * @param {string} query - Search term, name, phrase, address, number, Unicode text
 * @param {Object} options - Search options { exactPhrase: boolean, matchAllWords: boolean, caseSensitive: boolean, userId: string }
 * @returns {Promise<Object>} Search results with metadata and ranking
 */
export async function searchIndexedDocuments(query, options = {}) {
  const trimmed = (query || '').trim();

  if (!trimmed) {
    return {
      query: '',
      searchTimeMs: 0,
      totalMatches: 0,
      totalDocumentsMatched: 0,
      results: []
    };
  }

  // Check if configured in Supabase Cloud
  if (isSupabaseConfigured()) {
    try {
      return await searchCloudDocuments(trimmed, options, options.userId || 'public');
    } catch (cloudErr) {
      console.warn('Cloud search error, falling back to local search:', cloudErr);
    }
  }

  // Fallback to local IndexedDB search
  const startTime = performance.now();
  const {
    exactPhrase = false,
    matchAllWords = true,
    caseSensitive = false
  } = options;

  const normalizedQuery = trimmed.normalize('NFC');
  const regexFlags = caseSensitive ? 'gu' : 'giu';
  let searchRegex;
  let wordRegexes = [];

  if (exactPhrase) {
    searchRegex = new RegExp(escapeRegExp(normalizedQuery), regexFlags);
  } else {
    const tokens = normalizedQuery.split(/\s+/).filter(t => t.length > 0);
    if (tokens.length === 1) {
      searchRegex = new RegExp(escapeRegExp(tokens[0]), regexFlags);
    } else {
      wordRegexes = tokens.map(t => new RegExp(escapeRegExp(t), regexFlags));
      const combinedPattern = tokens.map(t => escapeRegExp(t)).join('|');
      searchRegex = new RegExp(combinedPattern, regexFlags);
    }
  }

  const allDocs = await db.documents.toArray();
  const docMap = new Map();
  allDocs.forEach(d => docMap.set(d.id, d));

  const matchedDocsMap = new Map();
  let totalGlobalMatches = 0;
  let scannedPagesCount = 0;

  await db.pages.each(async (page) => {
    scannedPagesCount++;
    if (scannedPagesCount % 200 === 0) {
      await new Promise(r => setTimeout(r, 0));
    }

    const docMeta = docMap.get(page.docId);
    if (!docMeta || docMeta.indexStatus !== 'indexed') return;

    const pageText = (page.text || '').normalize('NFC');
    if (!pageText) return;

    let isMatch = false;

    if (exactPhrase || wordRegexes.length === 0) {
      searchRegex.lastIndex = 0;
      isMatch = searchRegex.test(pageText);
    } else if (matchAllWords) {
      isMatch = wordRegexes.every(rx => {
        rx.lastIndex = 0;
        return rx.test(pageText);
      });
    } else {
      isMatch = wordRegexes.some(rx => {
        rx.lastIndex = 0;
        return rx.test(pageText);
      });
    }

    if (!isMatch) return;

    searchRegex.lastIndex = 0;
    const snippets = [];
    let match;
    let occurrencesOnPage = 0;

    while ((match = searchRegex.exec(pageText)) !== null) {
      occurrencesOnPage++;
      if (snippets.length < 5) {
        snippets.push(createSnippet(pageText, match.index, match[0].length));
      }
      if (match.index === searchRegex.lastIndex) {
        searchRegex.lastIndex++;
      }
    }

    if (occurrencesOnPage === 0) return;

    totalGlobalMatches += occurrencesOnPage;

    if (!matchedDocsMap.has(page.docId)) {
      let score = 0;
      const docNameLower = (docMeta.name || '').toLowerCase();
      const queryLower = normalizedQuery.toLowerCase();
      if (docNameLower.includes(queryLower)) {
        score += 100;
      }

      matchedDocsMap.set(page.docId, {
        docId: docMeta.id,
        name: docMeta.name,
        size: docMeta.size,
        uploadDate: docMeta.uploadDate,
        pageCount: docMeta.pageCount,
        ocrApplied: docMeta.ocrApplied,
        totalOccurrences: 0,
        relevanceScore: score,
        pages: []
      });
    }

    const docResult = matchedDocsMap.get(page.docId);
    docResult.totalOccurrences += occurrencesOnPage;
    docResult.relevanceScore += (occurrencesOnPage * 10) + 20;

    docResult.pages.push({
      pageNumber: page.pageNumber,
      hasOcr: page.hasOcr,
      occurrencesCount: occurrencesOnPage,
      snippets
    });
  });

  matchedDocsMap.forEach(docResult => {
    docResult.pages.sort((a, b) => a.pageNumber - b.pageNumber);
  });

  const results = Array.from(matchedDocsMap.values()).sort(
    (a, b) => b.relevanceScore - a.relevanceScore
  );

  const endTime = performance.now();
  const searchTimeMs = Math.round(endTime - startTime);

  if (trimmed.length >= 2) {
    try {
      await addSearchHistory(trimmed, totalGlobalMatches, results.length);
    } catch (e) {
      console.warn('Failed to record search history:', e);
    }
  }

  return {
    query: trimmed,
    searchTimeMs,
    totalMatches: totalGlobalMatches,
    totalDocumentsMatched: results.length,
    results
  };
}
