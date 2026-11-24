import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { queueManager } from './queueManager';

/**
 * Draw text onto an offscreen canvas and return PNG bytes
 * Enables creating realistic scanned / image-only PDF pages to test OCR
 */
function createScannedPageImage({ title, bodyLines, font = '24px sans-serif' }) {
  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 1600;
  const ctx = canvas.getContext('2d');

  // Background with subtle paper tone
  ctx.fillStyle = '#faf8f5';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Scanned document header
  ctx.fillStyle = '#1e293b';
  ctx.font = 'bold 36px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(title, 80, 120);

  // Decorative line
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(80, 140);
  ctx.lineTo(1120, 140);
  ctx.stroke();

  // Draw content lines
  ctx.fillStyle = '#334155';
  ctx.font = font;

  let y = 220;
  bodyLines.forEach(line => {
    ctx.fillText(line, 80, y);
    y += 55;
  });

  // Convert canvas to PNG blob
  return new Promise(resolve => {
    canvas.toBlob(blob => {
      blob.arrayBuffer().then(buf => resolve(new Uint8Array(buf)));
    }, 'image/png');
  });
}

/**
 * Generate 5 realistic test PDF documents directly in the browser
 * Including selectable text PDFs, multiple-occurrence PDFs, and scanned image PDFs for OCR testing
 */
export async function generateAndLoadSampleSuite() {
  const generatedFiles = [];

  // ==========================================
  // Document 1: Sameed Shaikh Profile & CV
  // ==========================================
  {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);

    // Page 1
    const p1 = doc.addPage([595, 842]);
    p1.drawText('CURRICULUM VITAE & PROFESSIONAL DOSSIER', { x: 50, y: 790, size: 16, font: bold, color: rgb(0.15, 0.2, 0.6) });
    p1.drawText('Full Name: Sameed Shaikh', { x: 50, y: 750, size: 14, font: bold, color: rgb(0.1, 0.1, 0.1) });
    p1.drawText('Residential Address: Satellite Road, Ahmedabad, Gujarat, India - 380015', { x: 50, y: 720, size: 11, font });
    p1.drawText('Telephone Contact: +91 98765 43210  |  Reference Code: 123456', { x: 50, y: 695, size: 11, font });
    p1.drawText('Designation: Lead Enterprise Solutions Architect', { x: 50, y: 670, size: 11, font: bold });
    p1.drawText('Summary: Sameed Shaikh has over 10 years of experience delivering browser-based', { x: 50, y: 640, size: 11, font });
    p1.drawText('document search engines, high-performance IndexedDB pipelines, and client-side OCR.', { x: 50, y: 620, size: 11, font });

    // Page 2
    const p2 = doc.addPage([595, 842]);
    p2.drawText('MAJOR PROJECTS & CONTRACT DELIVERABLES', { x: 50, y: 790, size: 14, font: bold, color: rgb(0.15, 0.2, 0.6) });
    p2.drawText('Project Alpha: Commercial Real Estate Development Agreement in Ahmedabad.', { x: 50, y: 750, size: 11, font });
    p2.drawText('Supervising Engineer: Sameed Shaikh. Official Approval ID: 123456-AMC.', { x: 50, y: 725, size: 11, font });
    p2.drawText('Project Beta: High-speed Unicode text search engine across English, Gujarati and Hindi.', { x: 50, y: 690, size: 11, font });
    p2.drawText('Key Architect: Sameed Shaikh. Evaluated in Ahmedabad municipal pilot.', { x: 50, y: 665, size: 11, font });

    const bytes = await doc.save();
    generatedFiles.push(new File([bytes], 'Sameed_Shaikh_Profile.pdf', { type: 'application/pdf' }));
  }

  // ==========================================
  // Document 2: Development Agreement Ahmedabad
  // ==========================================
  {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);

    const p1 = doc.addPage([595, 842]);
    p1.drawText('COMMERCIAL DEVELOPMENT AGREEMENT', { x: 50, y: 790, size: 16, font: bold, color: rgb(0.7, 0.1, 0.1) });
    p1.drawText('Contract Reference: 123456', { x: 50, y: 755, size: 12, font: bold });
    p1.drawText('Location of Execution: Ahmedabad Municipal Corporation Headquarters, Ahmedabad.', { x: 50, y: 725, size: 11, font });
    p1.drawText('THIS AGREEMENT is entered into between the Municipal Authority and Consultant Sameed Shaikh.', { x: 50, y: 695, size: 11, font });
    p1.drawText('Subject: Comprehensive Urban Development Agreement and digital documentation.', { x: 50, y: 665, size: 11, font });
    p1.drawText('Signed in the city of Ahmedabad by all authorized stakeholders.', { x: 50, y: 635, size: 11, font });

    const p2 = doc.addPage([595, 842]);
    p2.drawText('SCHEDULE OF PAYMENTS & COMPLIANCE (AHMEDABAD)', { x: 50, y: 790, size: 13, font: bold });
    p2.drawText('Voucher Identification Number: 123456-DEP.', { x: 50, y: 750, size: 11, font });
    p2.drawText('Contractor representative: Sameed Shaikh.', { x: 50, y: 720, size: 11, font });

    const bytes = await doc.save();
    generatedFiles.push(new File([bytes], 'Development_Agreement_Ahmedabad.pdf', { type: 'application/pdf' }));
  }

  // ==========================================
  // Document 3: Technical Architecture Spec
  // ==========================================
  {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);

    const p1 = doc.addPage([595, 842]);
    p1.drawText('SYSTEM SPECIFICATION & ARCHITECTURE', { x: 50, y: 790, size: 15, font: bold, color: rgb(0.1, 0.5, 0.2) });
    p1.drawText('Platform: PDF Document Search Engine (React.js Frontend Only)', { x: 50, y: 750, size: 12, font: bold });
    p1.drawText('Author: Sameed Shaikh', { x: 50, y: 720, size: 11, font });
    p1.drawText('Originating City: Ahmedabad, Gujarat', { x: 50, y: 695, size: 11, font });
    p1.drawText('Reference Specification: 123456', { x: 50, y: 670, size: 11, font });
    p1.drawText('Storage Layer: IndexedDB with Dexie.js for persistent client-side data.', { x: 50, y: 640, size: 11, font });

    const bytes = await doc.save();
    generatedFiles.push(new File([bytes], 'Technical_Architecture_Spec.pdf', { type: 'application/pdf' }));
  }

  // ==========================================
  // Document 4: Scanned OCR English Invoice (Image page, triggers OCR)
  // ==========================================
  {
    const doc = await PDFDocument.create();
    const pngBytes = await createScannedPageImage({
      title: 'SCANNED TAX INVOICE & RECEIPT',
      bodyLines: [
        'Document Type: Certified Scanned Copy',
        'Customer Name: Sameed Shaikh',
        'Billing Address: Satellite Road, Ahmedabad',
        'Invoice Reference Number: 123456',
        'Project: Development Agreement Consultation Services',
        'Status: Verified & Paid at Ahmedabad Bank Branch'
      ]
    });

    const pngImage = await doc.embedPng(pngBytes);
    const page = doc.addPage([595, 842]);
    page.drawImage(pngImage, {
      x: 0,
      y: 0,
      width: 595,
      height: 842
    });

    const bytes = await doc.save();
    generatedFiles.push(new File([bytes], 'Scanned_Invoice_Receipt.pdf', { type: 'application/pdf' }));
  }

  // ==========================================
  // Document 5: Scanned Multilingual Record (Gujarati & Hindi with OCR)
  // ==========================================
  {
    const doc = await PDFDocument.create();
    const pngBytes = await createScannedPageImage({
      title: 'OFFICIAL RECORD (GUJARATI & HINDI)',
      font: '24px "Noto Sans Gujarati", "Noto Sans Devanagari", sans-serif',
      bodyLines: [
        'English Name: Sameed Shaikh',
        'Gujarati Record: સમીદ શેખ - અમદાવાદ વિકાસ કરાર',
        'Gujarati City: અમદાવાદ (Ahmedabad)',
        'Hindi Record: समीर शेख - अहमदाबाद विकास अनुबंध',
        'Hindi City: अहमदाबाद (Ahmedabad)',
        'Official Reference Code: 123456',
        'Certification Status: Scanned and Registered'
      ]
    });

    const pngImage = await doc.embedPng(pngBytes);
    const page = doc.addPage([595, 842]);
    page.drawImage(pngImage, {
      x: 0,
      y: 0,
      width: 595,
      height: 842
    });

    const bytes = await doc.save();
    generatedFiles.push(new File([bytes], 'Scanned_Multilingual_Record.pdf', { type: 'application/pdf' }));
  }

  // Add all 5 generated test files to the processing queue
  await queueManager.addFiles(generatedFiles);
  return generatedFiles.length;
}
