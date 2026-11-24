import { createWorker } from 'tesseract.js';

let cachedWorker = null;
let currentLanguage = null;
let isInitializing = false;

/**
 * Initialize or get cached Tesseract worker
 * Supports English ('eng'), Gujarati ('guj'), Hindi ('hin') or combined ('eng+guj+hin')
 */
export async function getOcrWorker(language = 'eng+guj+hin', onProgress = null) {
  // If worker is already initialized with same language, return it
  if (cachedWorker && currentLanguage === language) {
    return cachedWorker;
  }

  // If worker exists with different language, terminate it first
  if (cachedWorker) {
    try {
      await cachedWorker.terminate();
    } catch (e) {
      console.warn('Error terminating previous OCR worker:', e);
    }
    cachedWorker = null;
  }

  try {
    const worker = await createWorker(language, 1, {
      logger: m => {
        if (onProgress && m.status === 'recognizing text') {
          onProgress(Math.round(m.progress * 100));
        }
      }
    });

    cachedWorker = worker;
    currentLanguage = language;
    return worker;
  } catch (err) {
    console.warn(`Failed to initialize OCR with language ${language}, falling back to 'eng'`, err);
    // Graceful fallback to English if special language files encounter issue
    if (language !== 'eng') {
      try {
        const fallbackWorker = await createWorker('eng', 1, {
          logger: m => {
            if (onProgress && m.status === 'recognizing text') {
              onProgress(Math.round(m.progress * 100));
            }
          }
        });
        cachedWorker = fallbackWorker;
        currentLanguage = 'eng';
        return fallbackWorker;
      } catch (fallbackErr) {
        throw new Error(`OCR initialization failed: ${fallbackErr.message}`);
      }
    }
    throw err;
  }
}

/**
 * Recognize text on a canvas or image element
 */
export async function recognizePageImage(canvasOrImage, language = 'eng+guj+hin', onProgress = null) {
  try {
    const worker = await getOcrWorker(language, onProgress);
    const ret = await worker.recognize(canvasOrImage);
    const text = ret.data.text || '';
    return {
      text: text.trim(),
      confidence: ret.data.confidence
    };
  } catch (err) {
    console.error('OCR recognition error:', err);
    return {
      text: '',
      confidence: 0,
      error: err.message
    };
  }
}

/**
 * Terminate worker when needed (e.g., settings change or memory cleanup)
 */
export async function terminateOcrWorker() {
  if (cachedWorker) {
    try {
      await cachedWorker.terminate();
    } catch (e) {
      console.warn('Error terminating OCR worker:', e);
    }
    cachedWorker = null;
    currentLanguage = null;
  }
}
