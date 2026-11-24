import 'fake-indexeddb/auto';
import { 
  db, 
  DEFAULT_SETTINGS, 
  getAllSettings, 
  setSetting, 
  getStorageStats, 
  validateUploadBatch,
  saveDocumentRecord,
  deleteDocument
} from './src/services/db.js';
import { queueManager } from './src/services/queueManager.js';

async function runLimitsTests() {
  console.log('=== Running PDF Upload Capacity & Storage Optimization Tests ===\n');

  // Test 1: Verify Initial Default Limits
  console.log('--- Test 1: Default Limit Configurations ---');
  const settings = await getAllSettings();
  console.log(`Default Max Document Count: ${settings.maxDocumentCount} (Expected: 500)`);
  console.log(`Default Max Individual File Size: ${settings.maxFileSizeMB} MB (Expected: 25)`);
  console.log(`Default Storage Budget: ${settings.storageBudgetGB} GB (Expected: 2.0)`);
  console.log(`Default Max Simultaneous Uploads: ${settings.maxSimultaneousUploads} (Expected: 10)`);
  console.log(`Default OCR Batch Concurrency: ${settings.ocrConcurrency} (Expected: 1)`);

  if (settings.maxDocumentCount !== 500) throw new Error('Default maxDocumentCount is not 500');
  if (settings.maxFileSizeMB !== 25) throw new Error('Default maxFileSizeMB is not 25');
  if (settings.storageBudgetGB !== 2.0) throw new Error('Default storageBudgetGB is not 2.0');
  if (settings.maxSimultaneousUploads !== 10) throw new Error('Default maxSimultaneousUploads is not 10');
  if (settings.ocrConcurrency !== 1) throw new Error('Default ocrConcurrency is not 1');
  console.log('✓ Test 1 Passed: All default limits comply with initial requirements.\n');

  // Test 2: Individual File Size Limit (25 MB)
  console.log('--- Test 2: Maximum Individual File Size Enforced (25 MB) ---');
  const validSizeFile = {
    name: 'valid_contract.pdf',
    size: 15 * 1024 * 1024, // 15 MB
    type: 'application/pdf'
  };

  const oversizedFile = {
    name: 'huge_archive.pdf',
    size: 26 * 1024 * 1024, // 26 MB (exceeds 25 MB limit)
    type: 'application/pdf'
  };

  const sizeValidation = await validateUploadBatch([validSizeFile, oversizedFile]);
  console.log(`Valid files accepted: ${sizeValidation.validFiles.length} (Expected: 1)`);
  console.log(`Errors emitted: ${JSON.stringify(sizeValidation.errors)}`);

  if (sizeValidation.validFiles.length !== 1 || sizeValidation.validFiles[0].name !== 'valid_contract.pdf') {
    throw new Error('Oversized file was not properly rejected');
  }
  if (!sizeValidation.errors.some(e => e.includes('exceeds maximum allowed file size of 25 MB'))) {
    throw new Error('Error message did not indicate 25 MB size limit violation');
  }
  console.log('✓ Test 2 Passed: 25 MB individual file size limit strictly enforced.\n');

  // Test 3: Maximum 10 Simultaneous Uploads
  console.log('--- Test 3: Maximum 10 Simultaneous Uploads Limit ---');
  const twelveFiles = [];
  for (let i = 1; i <= 12; i++) {
    twelveFiles.push({
      name: `document_${i}.pdf`,
      size: 500 * 1024, // 500 KB
      type: 'application/pdf'
    });
  }

  const batchValidation = await validateUploadBatch(twelveFiles);
  console.log(`Input files: 12 | Valid files queued: ${batchValidation.validFiles.length} (Expected: 10)`);
  console.log(`Batch notice: ${batchValidation.errors[0]}`);

  if (batchValidation.validFiles.length !== 10) {
    throw new Error(`Expected exactly 10 files queued, got ${batchValidation.validFiles.length}`);
  }
  console.log('✓ Test 3 Passed: Capped at maximum 10 simultaneous uploads.\n');

  // Test 4: Document Capacity Limit & Warning
  console.log('--- Test 4: Document Capacity Limit (Configurable to 500, 1000, 5000) ---');
  // Configure capacity to 3 for fast boundary test
  await setSetting('maxDocumentCount', 3);

  // Clear existing documents
  await db.documents.clear();
  await db.documentBlobs.clear();

  // Add 3 documents
  for (let i = 1; i <= 3; i++) {
    const f = new File([new Uint8Array(100)], `doc_${i}.pdf`, { type: 'application/pdf' });
    await saveDocumentRecord({ file: f });
  }

  const statsAfter3 = await getStorageStats();
  console.log(`Current docs: ${statsAfter3.currentDocCount} / Max docs: ${statsAfter3.maxDocs}`);
  console.log(`Remaining capacity: ${statsAfter3.remainingDocCapacity} (Expected: 0)`);
  console.log(`Capacity reached flag: ${statsAfter3.isDocLimitReached}`);

  if (statsAfter3.remainingDocCapacity !== 0 || !statsAfter3.isDocLimitReached) {
    throw new Error('Document capacity limit was not flagged when limit reached');
  }

  // Attempt to add a 4th document
  const overflowFile = new File([new Uint8Array(100)], 'doc_4_overflow.pdf', { type: 'application/pdf' });
  const overflowValidation = await validateUploadBatch([overflowFile]);
  console.log(`Overflow upload allowed: ${overflowValidation.isValid} (Expected: false)`);
  console.log(`Error: ${overflowValidation.errors[0]}`);

  if (overflowValidation.isValid) {
    throw new Error('Upload should have been blocked when document limit reached');
  }
  console.log('✓ Test 4 Passed: Document capacity limit strictly prevents overflow.\n');

  // Test 5: Document Deletion Frees Space and Capacity
  console.log('--- Test 5: Document Deletion Frees Storage & Capacity ---');
  const allDocs = await db.documents.toArray();
  const docToDelete = allDocs[0];
  console.log(`Deleting doc id=${docToDelete.id}...`);
  await deleteDocument(docToDelete.id);

  const statsAfterDelete = await getStorageStats();
  console.log(`Docs count after deletion: ${statsAfterDelete.currentDocCount} / ${statsAfterDelete.maxDocs}`);
  console.log(`Slots now available: ${statsAfterDelete.remainingDocCapacity} (Expected: 1)`);

  if (statsAfterDelete.remainingDocCapacity !== 1) {
    throw new Error('Deleting document did not restore remaining document capacity slot');
  }
  console.log('✓ Test 5 Passed: Deleting document restores document slot and frees storage.\n');

  // Test 6: Controlled OCR Concurrency (Clamped to 1-2)
  console.log('--- Test 6: Controlled OCR Batch Concurrency (1-2 PDFs) ---');
  await setSetting('ocrConcurrency', 1);
  await queueManager.processNext();
  console.log(`QueueManager concurrency with setting=1: ${queueManager.maxConcurrency}`);
  if (queueManager.maxConcurrency !== 1) throw new Error('Expected maxConcurrency 1');

  await setSetting('ocrConcurrency', 2);
  await queueManager.processNext();
  console.log(`QueueManager concurrency with setting=2: ${queueManager.maxConcurrency}`);
  if (queueManager.maxConcurrency !== 2) throw new Error('Expected maxConcurrency 2');

  // Even if user or script sets invalid high number e.g. 10, it must clamp to 2
  await setSetting('ocrConcurrency', 10);
  await queueManager.processNext();
  console.log(`QueueManager concurrency clamped with setting=10: ${queueManager.maxConcurrency}`);
  if (queueManager.maxConcurrency !== 2) throw new Error('Expected maxConcurrency to clamp to max 2');
  console.log('✓ Test 6 Passed: OCR concurrency strictly controlled to 1-2 batches.\n');

  // Test 7: Restore Default 500 Capacity Setting
  await setSetting('maxDocumentCount', 500);
  await setSetting('ocrConcurrency', 1);
  const finalSettings = await getAllSettings();
  console.log(`Final restored settings: maxDocumentCount=${finalSettings.maxDocumentCount}, budget=${finalSettings.storageBudgetGB}GB`);

  console.log('================================================================');
  console.log('ALL UPLOAD CAPACITY & STORAGE OPTIMIZATION TESTS PASSED (100%)!');
  console.log('================================================================');
}

runLimitsTests().catch(err => {
  console.error('\n❌ Test Error:', err);
  process.exit(1);
});
