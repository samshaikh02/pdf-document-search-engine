import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import fs from 'fs';
import path from 'path';

async function generateSamplePdfs() {
  const outputDir = path.resolve('./sample_test_pdfs');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // 1. Sameed Shaikh Profile Document
  const doc1 = await PDFDocument.create();
  const font1 = await doc1.embedFont(StandardFonts.Helvetica);
  const bold1 = await doc1.embedFont(StandardFonts.HelveticaBold);

  // Page 1
  const page1 = doc1.addPage([600, 400]);
  page1.drawText('CURRICULUM VITAE & PROFESSIONAL DOSSIER', {
    x: 50,
    y: 350,
    size: 16,
    font: bold1,
    color: rgb(0.1, 0.2, 0.6)
  });
  page1.drawText('Candidate Name: Sameed Shaikh', {
    x: 50,
    y: 310,
    size: 14,
    font: bold1,
    color: rgb(0.1, 0.1, 0.1)
  });
  page1.drawText('Address: Satellite Road, Ahmedabad, Gujarat, India - 380015', {
    x: 50,
    y: 280,
    size: 11,
    font: font1,
    color: rgb(0.2, 0.2, 0.2)
  });
  page1.drawText('Phone Contact: +91 98765 43210  |  Reference Number: 123456', {
    x: 50,
    y: 255,
    size: 11,
    font: font1,
    color: rgb(0.2, 0.2, 0.2)
  });
  page1.drawText('Professional Summary: Sameed Shaikh is a Senior Solutions Architect with deep', {
    x: 50,
    y: 220,
    size: 11,
    font: font1
  });
  page1.drawText('expertise in browser-based search engines, client-side indexing and OCR.', {
    x: 50,
    y: 200,
    size: 11,
    font: font1
  });

  // Page 2
  const page2 = doc1.addPage([600, 400]);
  page2.drawText('NOTABLE PROJECTS & CONTRACTS', {
    x: 50,
    y: 350,
    size: 14,
    font: bold1,
    color: rgb(0.1, 0.2, 0.6)
  });
  page2.drawText('1. Commercial Real Estate Development Agreement in Ahmedabad.', {
    x: 50,
    y: 310,
    size: 11,
    font: font1
  });
  page2.drawText('Lead Architect: Sameed Shaikh. Approval Code: 123456-AMC.', {
    x: 50,
    y: 285,
    size: 11,
    font: font1
  });
  page2.drawText('2. Local IndexedDB Search Engine with multilingual OCR capability.', {
    x: 50,
    y: 250,
    size: 11,
    font: font1
  });

  const pdfBytes1 = await doc1.save();
  fs.writeFileSync(path.join(outputDir, 'Sameed_Shaikh_Profile.pdf'), pdfBytes1);
  console.log('Created Sameed_Shaikh_Profile.pdf');

  // 2. Development Agreement Document
  const doc2 = await PDFDocument.create();
  const font2 = await doc2.embedFont(StandardFonts.Helvetica);
  const bold2 = await doc2.embedFont(StandardFonts.HelveticaBold);

  const d2p1 = doc2.addPage([600, 400]);
  d2p1.drawText('OFFICIAL DEVELOPMENT AGREEMENT', {
    x: 50,
    y: 350,
    size: 16,
    font: bold2,
    color: rgb(0.6, 0.1, 0.1)
  });
  d2p1.drawText('Document Reference Number: 123456', {
    x: 50,
    y: 320,
    size: 12,
    font: bold2
  });
  d2p1.drawText('This Development Agreement is executed on this day at Ahmedabad.', {
    x: 50,
    y: 280,
    size: 11,
    font: font2
  });
  d2p1.drawText('BETWEEN: Municipal Authorities of Ahmedabad AND Project Consultant Sameed Shaikh.', {
    x: 50,
    y: 250,
    size: 11,
    font: font2
  });
  d2p1.drawText('Terms and conditions apply as per Ahmedabad Municipal Corporation Bylaws.', {
    x: 50,
    y: 220,
    size: 11,
    font: font2
  });

  const pdfBytes2 = await doc2.save();
  fs.writeFileSync(path.join(outputDir, 'Development_Agreement_Ahmedabad.pdf'), pdfBytes2);
  console.log('Created Development_Agreement_Ahmedabad.pdf');

  // 3. Technical Architecture Specifications
  const doc3 = await PDFDocument.create();
  const font3 = await doc3.embedFont(StandardFonts.Helvetica);
  const bold3 = await doc3.embedFont(StandardFonts.HelveticaBold);

  const d3p1 = doc3.addPage([600, 400]);
  d3p1.drawText('TECHNICAL ARCHITECTURE & SPECIFICATIONS', {
    x: 50,
    y: 350,
    size: 14,
    font: bold3,
    color: rgb(0.1, 0.5, 0.2)
  });
  d3p1.drawText('System: PDF Document Search Engine (React.js Frontend Only)', {
    x: 50,
    y: 310,
    size: 11,
    font: font3
  });
  d3p1.drawText('Primary Author: Sameed Shaikh', {
    x: 50,
    y: 280,
    size: 11,
    font: font3
  });
  d3p1.drawText('City of Origin: Ahmedabad', {
    x: 50,
    y: 250,
    size: 11,
    font: font3
  });
  d3p1.drawText('Tracking Reference: 123456', {
    x: 50,
    y: 220,
    size: 11,
    font: font3
  });

  const pdfBytes3 = await doc3.save();
  fs.writeFileSync(path.join(outputDir, 'Technical_Architecture_Spec.pdf'), pdfBytes3);
  console.log('Created Technical_Architecture_Spec.pdf');
}

generateSamplePdfs().catch(console.error);
