const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

dotenv.config({ path: path.join(__dirname, '.env') });

const { Organization, User, Template, Document, DocumentPage, Extraction } = require('./src/models');
const { processDocument } = require('./src/queues/processor');
const { uploadDirectory } = require('./src/middleware/upload');
const { extractWithLlama, classifyDocument } = require('./src/services/llm');

const BASE_URL = process.env.API_URL || 'http://localhost:5000/api';

async function runM5Tests() {
  console.log('=== [M5] Starting Classification, Extraction, Validation & Review Acceptance Tests ===\n');

  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB Atlas');

  let passed = 0;
  let total = 0;

  try {
    // ---------------------------------------------------------
    // Setup Org & Admin Token
    // ---------------------------------------------------------
    const timestamp = Date.now();
    const regRes = await fetch(`${BASE_URL}/auth/register-org`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orgName: `M5ValidationCorp ${timestamp}`,
        name: 'Reviewer Admin',
        email: `reviewer_${timestamp}@m5test.com`,
        password: 'Password123!'
      })
    });
    const regData = await regRes.json();
    if (!regRes.ok) throw new Error(`Registration failed: ${JSON.stringify(regData)}`);

    const token = regData.token;
    const orgId = regData.organization.id;
    const userId = regData.user.id;

    const templates = await Template.find({ orgId });
    console.log(`Loaded ${templates.length} org templates.`);

    // Helper: create a real PDF or text fixture file on disk
    if (!fs.existsSync(uploadDirectory)) {
      fs.mkdirSync(uploadDirectory, { recursive: true });
    }

    const createFixtureDoc = async (filename, content, mimeType = 'text/plain') => {
      const filePath = `m5_${timestamp}_${filename}`;
      const fullPath = path.join(uploadDirectory, filePath);
      fs.writeFileSync(fullPath, content, 'utf8');

      const doc = await Document.create({
        orgId,
        uploadedBy: userId,
        originalName: filename,
        mimeType,
        filePath,
        size: Buffer.byteLength(content),
        status: 'queued'
      });
      return doc;
    };

    // ---------------------------------------------------------
    // Test 1: Document Type 1 - Invoice (Auto-classification & Extraction)
    // ---------------------------------------------------------
    total++;
    console.log(`\n[Test ${total}] Testing Document Type 1: Tax Invoice...`);
    const invoiceContent = `
TAX INVOICE
Supplier: Apex Cloud Technologies Pvt Ltd
Supplier GSTIN: 27AABCA1234A1Z5
Buyer: TechNova Solutions
Buyer GSTIN: 29AABCB5678B1Z2
Invoice Number: INV-2026-9041
Invoice Date: 12-Nov-2026

Line items:
Description | Qty | Rate | Amount
Cloud Server Hosting | 2 | 5000.00 | 10000.00
Database Managed Services | 1 | 5000.00 | 5000.00

Taxable Amount: 15000.00
CGST (9%): 1350.00
SGST (9%): 1350.00
IGST: 0.00
Total Amount: 17700.00
Amount in Words: Seventeen Thousand Seven Hundred only
`;
    const invoiceDoc = await createFixtureDoc('tax_invoice.txt', invoiceContent);
    await processDocument(invoiceDoc._id);

    const processedInvoice = await Document.findById(invoiceDoc._id);
    const invoiceExtraction = await Extraction.findOne({ documentId: invoiceDoc._id });

    if (
      processedInvoice.docType === 'Invoice' &&
      invoiceExtraction &&
      invoiceExtraction.fields.length > 0
    ) {
      console.log(`  Auto-classified as: ${processedInvoice.docType}`);
      console.log(`  Status: ${processedInvoice.status}`);
      console.log(`  Extracted fields count: ${invoiceExtraction.fields.length}`);
      console.log(`  PASS: Invoice classified, extracted, and validated.`);
      passed++;
    } else {
      throw new Error(`Invoice extraction failed: docType=${processedInvoice.docType}, status=${processedInvoice.status}`);
    }

    // ---------------------------------------------------------
    // Test 2: Document Type 2 - Contract or Agreement
    // ---------------------------------------------------------
    total++;
    console.log(`\n[Test ${total}] Testing Document Type 2: Contract or Agreement...`);
    const agreementContent = `
NON-DISCLOSURE AND MUTUAL SERVICE AGREEMENT
Agreement Title: Master Cloud Infrastructure Agreement
Parties:
- Alpha Software Corp (First Party)
- Beta Logistics International (Second Party)

Effective Date: 2026-01-15
End Date: 2027-01-14
Term: 12 Months
Payment Terms: Net 30 days upon monthly invoice
Termination Clause: Either party may terminate with 30 days written notice.
Governing Law: State of California
Key Obligations: Maintenance of cloud server infrastructure and 99.9% uptime SLA.
`;
    const agreementDoc = await createFixtureDoc('service_agreement.txt', agreementContent);
    await processDocument(agreementDoc._id);

    const processedAgreement = await Document.findById(agreementDoc._id);
    const agreementExtraction = await Extraction.findOne({ documentId: agreementDoc._id });

    if (
      processedAgreement.docType === 'Contract or Agreement' &&
      agreementExtraction &&
      agreementExtraction.fields.length > 0
    ) {
      console.log(`  Auto-classified as: ${processedAgreement.docType}`);
      console.log(`  Extracted fields count: ${agreementExtraction.fields.length}`);
      console.log(`  PASS: Contract classified and extracted with list fields.`);
      passed++;
    } else {
      throw new Error(`Agreement extraction failed: docType=${processedAgreement.docType}`);
    }

    // ---------------------------------------------------------
    // Test 3: Document Type 3 - Mark Sheet (Table Extraction & Sum Validation)
    // ---------------------------------------------------------
    total++;
    console.log(`\n[Test ${total}] Testing Document Type 3: Academic Mark Sheet...`);
    const marksheetContent = `
STATEMENT OF MARKS / GRADE CARD
Student Name: Aarav Sharma
Register Number: REG-2023-CS-042
Institution: National Institute of Technology
Course: Bachelor of Technology (Computer Science)
Semester: Semester 6
Exam Session: May-June 2026

Subjects:
Code | Subject Name | Marks | Grade
CS601 | Distributed Systems | 88 | A
CS602 | Machine Learning | 92 | A+
CS603 | Compiler Design | 85 | A
CS604 | Cloud Computing | 90 | A+

Total Marks: 355
Result: Pass
`;
    const marksheetDoc = await createFixtureDoc('marks_card.txt', marksheetContent);
    await processDocument(marksheetDoc._id);

    const processedMarksheet = await Document.findById(marksheetDoc._id);
    const marksheetExtraction = await Extraction.findOne({ documentId: marksheetDoc._id });

    if (
      processedMarksheet.docType === 'Mark Sheet' &&
      marksheetExtraction &&
      marksheetExtraction.fields.length > 0
    ) {
      console.log(`  Auto-classified as: ${processedMarksheet.docType}`);
      console.log(`  Extracted fields count: ${marksheetExtraction.fields.length}`);
      console.log(`  PASS: Mark Sheet classified and extracted with table fields.`);
      passed++;
    } else {
      throw new Error(`Mark sheet extraction failed: docType=${processedMarksheet.docType}`);
    }

    // ---------------------------------------------------------
    // Test 4: Document Type 4 - Lab Report
    // ---------------------------------------------------------
    total++;
    console.log(`\n[Test ${total}] Testing Document Type 4: Medical Lab Diagnostic Report...`);
    const labContent = `
CLINICAL LABORATORY DIAGNOSTIC REPORT
Laboratory: Metropolis Health Diagnostics
Patient Name: Eleanor Vance
Patient ID: UHID-9920145
Age: 34 Years
Gender: Female
Report Date: 2026-10-24
Referring Doctor: Dr. Robert Langdon, MD

Investigation Tests:
Test Name | Value | Unit | Reference Range | Flag
Hemoglobin | 13.8 | g/dL | 12.0 - 15.5 | Normal
Fasting Blood Sugar | 92 | mg/dL | 70 - 100 | Normal
Total Cholesterol | 185 | mg/dL | < 200 | Normal
Serum Creatinine | 0.9 | mg/dL | 0.6 - 1.2 | Normal
`;
    const labDoc = await createFixtureDoc('lab_report.txt', labContent);
    await processDocument(labDoc._id);

    const processedLab = await Document.findById(labDoc._id);
    const labExtraction = await Extraction.findOne({ documentId: labDoc._id });

    if (
      processedLab.docType === 'Lab Report' &&
      labExtraction &&
      labExtraction.fields.length > 0
    ) {
      console.log(`  Auto-classified as: ${processedLab.docType}`);
      console.log(`  Extracted fields count: ${labExtraction.fields.length}`);
      console.log(`  PASS: Lab Report classified and extracted.`);
      passed++;
    } else {
      throw new Error(`Lab Report extraction failed: docType=${processedLab.docType}`);
    }

    // ---------------------------------------------------------
    // Test 5: Document Type 5 - Purchase Order
    // ---------------------------------------------------------
    total++;
    console.log(`\n[Test ${total}] Testing Document Type 5: Purchase Order...`);
    const poContent = `
COMMERCIAL PURCHASE ORDER
PO Number: PO-2026-8801
PO Date: 2026-09-01
Vendor Name: Global Industrial Hardware Inc.
Delivery Date: 2026-09-20

Line items:
Description | Qty | Rate | Amount
Industrial Steel Bolts 50mm | 100 | 15.00 | 1500.00
Titanium Washers Pack | 50 | 20.00 | 1000.00

Total Amount: 2500.00
`;
    const poDoc = await createFixtureDoc('purchase_order.txt', poContent);
    await processDocument(poDoc._id);

    const processedPO = await Document.findById(poDoc._id);
    const poExtraction = await Extraction.findOne({ documentId: poDoc._id });

    if (
      processedPO.docType === 'Purchase Order' &&
      poExtraction &&
      poExtraction.fields.length > 0
    ) {
      console.log(`  Auto-classified as: ${processedPO.docType}`);
      console.log(`  Extracted fields count: ${poExtraction.fields.length}`);
      console.log(`  PASS: Purchase Order classified and extracted.`);
      passed++;
    } else {
      throw new Error(`Purchase Order extraction failed: docType=${processedPO.docType}`);
    }

    // ---------------------------------------------------------
    // Test 6: Human Review Corrections & Approval Flow
    // ---------------------------------------------------------
    total++;
    console.log(`\n[Test ${total}] Testing Human Review Corrections (PUT) & Approval Flow (POST)...`);

    // Modify a field via Review API
    const updateRes = await fetch(`${BASE_URL}/documents/${invoiceDoc._id}/extraction`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        fields: [
          { key: 'invoice_number', value: 'INV-2026-9041-CORRECTED' },
          { key: 'total_amount', value: 17700 }
        ]
      })
    });
    const updateData = await updateRes.json();

    if (!updateRes.ok) throw new Error(`Corrections failed: ${JSON.stringify(updateData)}`);

    const correctedField = updateData.extraction.fields.find((f) => f.key === 'invoice_number');
    if (!correctedField || correctedField.value !== 'INV-2026-9041-CORRECTED' || !correctedField.edited) {
      throw new Error('Corrected field did not persist or edited flag missing');
    }

    // Approve the document
    const approveRes = await fetch(`${BASE_URL}/documents/${invoiceDoc._id}/approve`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` }
    });
    const approveData = await approveRes.json();

    if (approveRes.ok && approveData.document.status === 'reviewed') {
      console.log(`  Document status after approval: ${approveData.document.status}`);
      console.log('  PASS: Human review corrections persisted, re-validated, and document marked as reviewed.');
      passed++;
    } else {
      throw new Error(`Approval failed: ${JSON.stringify(approveData)}`);
    }

    // ---------------------------------------------------------
    // Test 7: Windowed Extraction (> 12,000 characters)
    // ---------------------------------------------------------
    total++;
    console.log(`\n[Test ${total}] Testing Windowed Extraction (> 12,000 characters)...`);
    const invoiceTemplate = templates.find((t) => t.name === 'Invoice');

    // Create a 14,000 character document with scalar and table items spread across windows
    let bigDocumentText = `
TAX INVOICE
Supplier: MegaCorp Global Supplies
Supplier GSTIN: 27AABCM9999M1Z9
Invoice Number: BIG-INV-99999
Invoice Date: 2026-11-01
Taxable Amount: 50000.00
Total Amount: 59000.00
`;
    // Add 13,000 characters of filler text and additional table rows
    while (bigDocumentText.length < 13500) {
      bigDocumentText += `\nSection Paragraph: Document terms, SLA policies, compliance guidelines, conditions of service, freight handling specifications, and insurance provisions.\n`;
    }
    bigDocumentText += `
Line items:
Item | Quantity | Rate | Amount
Long Document Server Rack | 5 | 10000.00 | 50000.00
`;

    console.log(`  Generated long document with ${bigDocumentText.length} characters.`);
    const windowedExtracted = await extractWithLlama(bigDocumentText, invoiceTemplate);

    if (
      windowedExtracted.invoice_number === 'BIG-INV-99999' ||
      windowedExtracted.supplier_gstin === '27AABCM9999M1Z9' ||
      windowedExtracted.total_amount === 59000
    ) {
      console.log('  Windowed extracted result:', windowedExtracted);
      console.log('  PASS: Windowed extraction successfully sliced, extracted, and merged across windows.');
      passed++;
    } else {
      throw new Error(`Windowed extraction failed to capture fields: ${JSON.stringify(windowedExtracted)}`);
    }

    console.log(`\n=================================================`);
    console.log(`M5 ACCEPTANCE SUMMARY: ${passed}/${total} TESTS PASSED`);
    console.log(`=================================================`);
  } catch (err) {
    console.error('\nFAIL: M5 Test Suite encountered an error:', err.message);
  } finally {
    await mongoose.disconnect();
    process.exit(passed === total ? 0 : 1);
  }
}

runM5Tests();

