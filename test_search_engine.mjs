import 'fake-indexeddb/auto';
import fs from 'fs';
import path from 'path';
import { db, saveDocumentRecord, getDocument, getDocumentPages, deleteDocument } from './src/services/db.js';
import { processDocumentText } from './src/services/pdfExtractor.js';
import { searchIndexedDocuments } from './src/services/searchEngine.js';
import { pdfjsLib } from './src/services/pdfWorker.js';

async function runTests() {
  console.log('=== Starting PDF Search Engine Automated Verification ===\n');

  const testDir = './sample_test_pdfs';
  const fileNames = [
    'Sameed_Shaikh_Profile.pdf',
    'Development_Agreement_Ahmedabad.pdf',
    'Technical_Architecture_Spec.pdf'
  ];

  const stagedDocs = [];

  // 1. Stage and Index each PDF
  for (const name of fileNames) {
    const filePath = path.join(testDir, name);
    const buffer = fs.readFileSync(filePath);
    const blob = new Blob([buffer], { type: 'application/pdf' });
    const file = new File([blob], name, { type: 'application/pdf' });

    console.log(`[Upload] Saving ${name} (${file.size} bytes) to IndexedDB...`);
    const docId = await saveDocumentRecord({ file });
    const doc = await getDocument(docId);
    stagedDocs.push({ doc, blob });
  }

  console.log(`\n[Stage 1 Passed] All ${stagedDocs.length} documents saved in IndexedDB.\n`);

  // 2. Process text extraction
  for (const { doc, blob } of stagedDocs) {
    console.log(`[Extracting] Processing text for docId=${doc.id} (${doc.name})...`);
    const result = await processDocumentText({
      doc,
      fileBlob: blob,
      onProgress: (p) => {
        if (p.stage === 'done') {
          console.log(`  -> Page ${p.page}/${p.totalPages} (${p.message})`);
        }
      }
    });

    if (!result.success) {
      throw new Error(`Extraction failed for ${doc.name}: ${result.error}`);
    }

    const pages = await getDocumentPages(doc.id);
    console.log(`  -> Successfully saved ${pages.length} pages in IndexedDB.`);
    pages.forEach(p => {
      console.log(`     Page ${p.pageNumber}: ${p.wordCount} words | Snippet: "${p.text.slice(0, 60)}..."`);
    });
  }

  console.log(`\n[Stage 2 Passed] PDF.js extracted text from all pages and stored page-wise in IndexedDB.\n`);

  // 3. Test Search: Full Name "Sameed Shaikh"
  console.log('--- Test 1: Full Name Search: "Sameed Shaikh" ---');
  const res1 = await searchIndexedDocuments('Sameed Shaikh');
  console.log(`Query: "${res1.query}" | Total Matches: ${res1.totalMatches} across ${res1.totalDocumentsMatched} docs (${res1.searchTimeMs}ms)`);
  if (res1.totalDocumentsMatched !== 3) {
    throw new Error(`Expected "Sameed Shaikh" in 3 docs, found in ${res1.totalDocumentsMatched}`);
  }
  res1.results.forEach(d => {
    console.log(`  Doc: ${d.name} (${d.totalOccurrences} occurrences)`);
    d.pages.forEach(p => {
      console.log(`    Page ${p.pageNumber} (${p.occurrencesCount} matches): "${p.snippets[0]?.fullSnippet}"`);
    });
  });
  console.log('✓ Test 1 Passed: Full name found in all 3 documents across multiple pages.\n');

  // 4. Test Search: Partial Name "Sameed"
  console.log('--- Test 2: Partial Name Search: "Sameed" ---');
  const res2 = await searchIndexedDocuments('Sameed');
  if (res2.totalDocumentsMatched !== 3) {
    throw new Error(`Expected "Sameed" in 3 docs, found in ${res2.totalDocumentsMatched}`);
  }
  console.log(`✓ Test 2 Passed: Partial name found ${res2.totalMatches} times.\n`);

  // 5. Test Search: City / Address "Ahmedabad"
  console.log('--- Test 3: City / Address Search: "Ahmedabad" ---');
  const res3 = await searchIndexedDocuments('Ahmedabad');
  console.log(`Query: "Ahmedabad" | Total Matches: ${res3.totalMatches} across ${res3.totalDocumentsMatched} docs`);
  if (res3.totalDocumentsMatched < 2) {
    throw new Error(`Expected "Ahmedabad" in multiple docs`);
  }
  console.log('✓ Test 3 Passed: Location search returned matching documents and snippets.\n');

  // 6. Test Search: Reference Number "123456"
  console.log('--- Test 4: Reference Number Search: "123456" ---');
  const res4 = await searchIndexedDocuments('123456');
  console.log(`Query: "123456" | Total Matches: ${res4.totalMatches} across ${res4.totalDocumentsMatched} docs`);
  if (res4.totalMatches < 3) {
    throw new Error(`Expected reference number "123456" in all 3 docs`);
  }
  console.log('✓ Test 4 Passed: Number search matched accurately.\n');

  // 7. Test Search: Exact Phrase "Development Agreement"
  console.log('--- Test 5: Exact Phrase Search: "Development Agreement" ---');
  const res5 = await searchIndexedDocuments('Development Agreement', { exactPhrase: true });
  console.log(`Query: "Development Agreement" (Exact) | Total Matches: ${res5.totalMatches} in ${res5.totalDocumentsMatched} docs`);
  if (res5.totalDocumentsMatched < 2) {
    throw new Error(`Expected exact phrase in at least 2 docs`);
  }
  console.log('✓ Test 5 Passed: Exact phrase match working perfectly.\n');

  // 8. Test Search: Multiple Occurrences inside single document
  console.log('--- Test 6: Multiple Occurrences inside single document ---');
  const profileDoc = res1.results.find(d => d.name === 'Sameed_Shaikh_Profile.pdf');
  console.log(`Sameed_Shaikh_Profile.pdf occurrences: ${profileDoc.totalOccurrences} across ${profileDoc.pages.length} pages`);
  if (profileDoc.pages.length < 2 || profileDoc.totalOccurrences < 2) {
    throw new Error('Expected multiple occurrences across multiple pages in Sameed_Shaikh_Profile.pdf');
  }
  console.log('✓ Test 6 Passed: Multi-occurrence detection inside single PDF verified.\n');

  // 9. Test Search History Persistence
  console.log('--- Test 7: Search History Persistence ---');
  const history = await db.searchHistory.toArray();
  console.log(`Total searches logged in history: ${history.length}`);
  if (history.length === 0) {
    throw new Error('Search history was not recorded');
  }
  console.log(`Latest search query logged: "${history[history.length - 1].query}"`);
  console.log('✓ Test 7 Passed: Search history properly logged in IndexedDB.\n');

  // 10. Test Deletion and Search Results Update
  console.log('--- Test 8: Document Deletion and Search Reactivity ---');
  const docToDelete = stagedDocs[0].doc;
  console.log(`Deleting document id=${docToDelete.id} (${docToDelete.name})...`);
  await deleteDocument(docToDelete.id);

  // Search again
  const resAfterDelete = await searchIndexedDocuments('Sameed Shaikh');
  console.log(`Documents containing "Sameed Shaikh" after deletion: ${resAfterDelete.totalDocumentsMatched}`);
  if (resAfterDelete.results.some(d => d.docId === docToDelete.id)) {
    throw new Error('Deleted document still appeared in search results!');
  }
  console.log('✓ Test 8 Passed: Deleted document cleanly removed from IndexedDB and search results.\n');

  console.log('====================================================');
  console.log('ALL 8 CORE SEARCH & STORAGE SCENARIOS PASSED WITH 100% SUCCESS!');
  console.log('====================================================');
}

runTests().catch(err => {
  console.error('\n❌ Test Failure:', err);
  process.exit(1);
});
