const mongoose = require('mongoose');
require('dotenv').config();

const { Organization, User, Document, DocumentPage, Template, Extraction } = require('./src/models');
const { validateExtraction } = require('./src/services/validate');
const { scoreConfidence } = require('./src/services/confidence');
const { extractWithLlama, buildSchema } = require('./src/services/llm');

async function testPhase3() {
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 15000 });
  console.log('Connected to DB for Phase 3 Verification');

  const org = await Organization.create({ name: 'Phase 3 Verification Firm' });
  const reviewer = await User.create({
    orgId: org._id,
    name: 'Compliance Officer',
    email: 'compliance_' + Date.now() + '@audit.org',
    passwordHash: 'dummy',
    role: 'reviewer'
  });

  // --- 1. TEST VALIDATION RULES ---
  console.log('\n--- 1. Testing Business Rule Validations ---');
  const validData = {
    invoice_number: 'INV-2026-001',
    gstin: '29ABCDE1234F1Z5',
    total_amount: 5000
  };
  const validIssues = await validateExtraction(validData, org._id, null);
  console.log('1a. Valid GSTIN issues count:', validIssues.length, '(Expected 0)');

  const invalidData = {
    invoice_number: 'INV-2026-001',
    gstin: 'NOT_A_VALID_GSTIN',
    total_amount: 5000,
    items: [{ amount: 2000 }, { amount: 1000 }] // sum = 3000 != 5000
  };
  const invalidIssues = await validateExtraction(invalidData, org._id, null);
  console.log('1b. Invalid GSTIN and Total mismatch issues:', invalidIssues);
  if (invalidIssues.length < 2) throw new Error('Validation rules did not catch errors!');

  // --- 2. TEST CONFIDENCE SCORING ---
  console.log('\n--- 2. Testing Confidence Scoring Algorithm ---');
  const templateFields = [
    { key: 'invoice_number', label: 'Invoice Number', type: 'string' },
    { key: 'gstin', label: 'Supplier GSTIN', type: 'string' },
    { key: 'hallucinated_item', label: 'Missing Item', type: 'string' }
  ];

  const extracted = {
    invoice_number: 'INV-2026-001',
    gstin: 'NOT_A_VALID_GSTIN',
    hallucinated_item: 'Super Fancy Widget XYZ'
  };

  const pages = [
    {
      pageNumber: 1,
      text: 'Tax Invoice INV-2026-001 issued to customer. Total is 5000.',
      ocrConfidence: 95
    }
  ];

  const scored = scoreConfidence(templateFields, extracted, pages, invalidIssues);
  console.log('2a. Scored fields:');
  scored.forEach(f => {
    console.log(`   - ${f.key}: val="${f.value}", confidence=${f.confidence}, sourcePage=${f.sourcePage}`);
  });

  const invField = scored.find(f => f.key === 'invoice_number');
  const gstinField = scored.find(f => f.key === 'gstin');
  const missField = scored.find(f => f.key === 'hallucinated_item');

  if (invField.confidence !== 0.9) throw new Error('Exact match did not score 0.9');
  if (gstinField.confidence > 0.3) throw new Error('Failed validation rule did not cap score at <= 0.3');
  if (missField.confidence !== 0.4) throw new Error('Missing match did not score 0.4');
  console.log('   Confidence scoring verified: PASSED');

  // --- 3. TEST LLM RESILIENCE & ZOD VALIDATION ---
  console.log('\n--- 3. Testing LLM Zod Schema & Resilience ---');
  const schema = buildSchema(templateFields);
  const testJson = { invoice_number: 'INV-99', gstin: null };
  const parseResult = schema.safeParse(testJson);
  console.log('3a. Zod schema validation check:', parseResult.success ? 'PASSED' : 'FAILED');

  // --- 4. TEST HUMAN REVIEW CORRECTION & APPROVAL ---
  console.log('\n--- 4. Testing Human Review & Approval Lifecycle ---');
  const doc = await Document.create({
    orgId: org._id,
    uploadedBy: reviewer._id,
    originalName: 'March_Bill.pdf',
    mimeType: 'application/pdf',
    filePath: 'test.pdf',
    size: 100,
    status: 'needs_review'
  });

  const extractionRecord = await Extraction.create({
    orgId: org._id,
    documentId: doc._id,
    templateId: new mongoose.Types.ObjectId(),
    fields: scored,
    validationIssues: invalidIssues
  });

  // Human reviewer corrects the invalid GSTIN
  const gstinToFix = extractionRecord.fields.find(f => f.key === 'gstin');
  gstinToFix.value = '29ABCDE1234F1Z5';
  gstinToFix.edited = true;
  gstinToFix.confidence = 1.0;
  await extractionRecord.save();
  console.log('4a. Human correction saved: GSTIN set to', gstinToFix.value, 'Confidence:', gstinToFix.confidence);

  // Approval step
  doc.status = 'reviewed';
  extractionRecord.reviewedBy = reviewer._id;
  extractionRecord.reviewedAt = new Date();
  await doc.save();
  await extractionRecord.save();

  const finalDoc = await Document.findById(doc._id);
  const finalExt = await Extraction.findById(extractionRecord._id);
  console.log('4b. Approval check: Doc Status =', finalDoc.status, 'ReviewedBy =', finalExt.reviewedBy);
  if (finalDoc.status !== 'reviewed' || !finalExt.reviewedAt) {
    throw new Error('Approval check failed!');
  }
  console.log('   Review & Approval Lifecycle: PASSED');

  // --- 5. CLEANUP ---
  await Extraction.deleteOne({ _id: extractionRecord._id });
  await Document.deleteOne({ _id: doc._id });
  await User.deleteOne({ _id: reviewer._id });
  await Organization.deleteOne({ _id: org._id });
  console.log('\n5. Test data cleaned up successfully');

  await mongoose.disconnect();
  console.log('ALL PHASE 3 CHECKS PASSED SUCCESSFULLY!');
}

testPhase3().catch(err => {
  console.error('Phase 3 test error:', err);
  process.exit(1);
});

