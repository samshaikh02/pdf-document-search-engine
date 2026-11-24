import { pdfjsLib } from './pdfWorker.js';
import { recognizePageImage } from './ocrService.js';
import { 
  updateDocStatus, 
  savePageTextRecord, 
  getSetting 
} from './db.js';
import { 
  updateCloudDocStatus, 
  saveCloudPageText 
} from './cloudDb.js';

/**
 * Render a PDF page onto an in-memory canvas
 * Scaled up to 2x for sharp OCR character recognition
 */
async function renderPageToCanvas(page, scale = 2.0) {
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  const renderContext = {
    canvasContext: ctx,
    viewport: viewport
  };

  await page.render(renderContext).promise;
  return canvas;
}

/**
 * Extract text from a single PDF document page by page
 * Direct text extraction first; triggers OCR when direct text is sparse
 * 
 * @param {Object} doc - Document record from DB { id, name, size, ... }
 * @param {Blob|File} fileBlob - PDF File or Blob
 * @param {Function} onProgress - Callback for progress reporting ({ docId, page, totalPages, stage, message })
 * @param {AbortSignal} abortSignal - Optional signal to cancel extraction
 */
export async function processDocumentText({
  doc,
  fileBlob,
  onProgress = () => {},
  abortSignal = null
}) {
  const docId = doc.id;
  const isCloud = Boolean(doc.storage_path || doc.storagePath || doc.user_id || doc.userId);
  const userId = doc.user_id || doc.userId;
  let pdfDoc = null;

  try {
    // Notify starting
    if (isCloud) {
      await updateCloudDocStatus(docId, 'processing', { error: null });
    }
    await updateDocStatus(docId, 'processing', { error: null });

    onProgress({
      docId,
      page: 0,
      totalPages: 0,
      stage: 'loading',
      message: 'Loading PDF document...'
    });

    // Check cancellation
    if (abortSignal?.aborted) throw new Error('Cancelled by user');

    // Read file buffer
    const arrayBuffer = await fileBlob.arrayBuffer();

    // Check cancellation
    if (abortSignal?.aborted) throw new Error('Cancelled by user');

    // Load PDF with cmaps and standard fonts for accurate Unicode decoding
    const loadingTask = pdfjsLib.getDocument({
      data: arrayBuffer,
      cMapUrl: typeof window !== 'undefined' ? '/cmaps/' : undefined,
      cMapPacked: true,
      standardFontDataUrl: typeof window !== 'undefined' ? '/standard_fonts/' : undefined,
      enableXfa: false
    });

    pdfDoc = await loadingTask.promise;
    const numPages = pdfDoc.numPages;

    // Fetch user settings for OCR
    const ocrEnabled = await getSetting('ocrEnabled', true);
    const ocrLanguages = await getSetting('ocrLanguages', 'eng+guj+hin');
    const autoOcr = await getSetting('autoOcr', true);
    const minCharsForOcr = await getSetting('minCharsForOcr', 25);

    let totalExtractedWords = 0;
    let ocrPageCount = 0;
    let ocrApplied = false;

    // Process page by page in sequence to manage memory
    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      if (abortSignal?.aborted) throw new Error('Cancelled by user');

      onProgress({
        docId,
        page: pageNum,
        totalPages: numPages,
        stage: 'extracting',
        message: `Extracting text: Page ${pageNum} of ${numPages}`
      });

      const page = await pdfDoc.getPage(pageNum);

      // Extract selectable text via PDF.js
      const textContent = await page.getTextContent();
      let directText = textContent.items
        .map(item => item.str)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();

      let finalText = directText;
      let hasOcr = false;

      // Check if page needs OCR (scanned or image-only page)
      const isSparseText = directText.length < minCharsForOcr;
      if (isSparseText && ocrEnabled && autoOcr) {
        onProgress({
          docId,
          page: pageNum,
          totalPages: numPages,
          stage: 'ocr',
          message: `Running OCR on Page ${pageNum} of ${numPages} (${ocrLanguages})...`
        });

        try {
          const canvas = await renderPageToCanvas(page, 2.0);
          const ocrResult = await recognizePageImage(canvas, ocrLanguages, (ocrPercent) => {
            onProgress({
              docId,
              page: pageNum,
              totalPages: numPages,
              stage: 'ocr',
              message: `OCR Page ${pageNum}/${numPages}: ${ocrPercent}%`
            });
          });

          // Free canvas memory
          canvas.width = 0;
          canvas.height = 0;

          if (ocrResult.text && ocrResult.text.length > 0) {
            hasOcr = true;
            ocrApplied = true;
            ocrPageCount++;
            // Combine any sparse direct text with OCR text
            finalText = (directText ? directText + '\n' : '') + ocrResult.text;
          }
        } catch (ocrErr) {
          console.warn(`OCR failed for page ${pageNum}:`, ocrErr);
        }
      }

      // Save page text to PostgreSQL if Cloud Mode
      if (isCloud) {
        await saveCloudPageText({
          docId,
          userId: userId || 'public',
          pageNumber: pageNum,
          text: finalText,
          hasOcr
        });
      }

      // Save page text to local IndexedDB cache
      await savePageTextRecord({
        docId,
        pageNumber: pageNum,
        text: finalText,
        hasOcr
      });

      const words = finalText.trim() ? finalText.trim().split(/\s+/).length : 0;
      totalExtractedWords += words;

      // Yield execution to the browser event loop so UI never freezes
      await new Promise(resolve => setTimeout(resolve, 15));

      // Release page resources
      page.cleanup();
    }

    // Mark document as successfully indexed in Cloud & Local
    if (isCloud) {
      await updateCloudDocStatus(docId, 'indexed', {
        page_count: numPages,
        ocr_applied: ocrApplied,
        ocr_page_count: ocrPageCount,
        extracted_words_count: totalExtractedWords,
        error: null
      });
    }

    await updateDocStatus(docId, 'indexed', {
      pageCount: numPages,
      ocrApplied,
      ocrPageCount,
      extractedWordsCount: totalExtractedWords,
      error: null
    });

    onProgress({
      docId,
      page: numPages,
      totalPages: numPages,
      stage: 'done',
      message: `Completed! Indexed ${numPages} pages (${totalExtractedWords} words)`
    });

    return {
      success: true,
      pageCount: numPages,
      totalWords: totalExtractedWords,
      ocrApplied,
      ocrPageCount
    };

  } catch (err) {
    console.error(`Error processing document ${doc.name}:`, err);
    const isCancelled = err.message === 'Cancelled by user';
    const errorStatus = isCancelled ? 'pending' : 'failed';
    const errorMessage = isCancelled ? 'Processing paused' : (err.message || 'Unknown processing error');

    if (isCloud) {
      await updateCloudDocStatus(docId, errorStatus, {
        error: errorMessage
      });
    }

    await updateDocStatus(docId, errorStatus, {
      error: errorMessage
    });

    onProgress({
      docId,
      page: 0,
      totalPages: 0,
      stage: 'error',
      message: errorMessage
    });

    return {
      success: false,
      error: errorMessage,
      isCancelled
    };
  } finally {
    if (pdfDoc) {
      try {
        await pdfDoc.destroy();
      } catch (e) {
        // Ignore destroy error
      }
    }
  }
}
