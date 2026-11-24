import * as pdfjsModule from 'pdfjs-dist';

const pdfjsLib = pdfjsModule.default || pdfjsModule;

// Use local worker copied to public directory for complete offline capability
if (typeof window !== 'undefined' && pdfjsLib.GlobalWorkerOptions) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
}

export { pdfjsLib };
