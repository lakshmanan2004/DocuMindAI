const mongoose = require('mongoose');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../.env') });

const { classifyDocument, extractWithLlama } = require('../src/services/llm');
const { builtInTemplates } = require('../src/seed/templates');
const { scoreConfidence } = require('../src/services/confidence');

// Create mock templates with ObjectIds
const mockTemplates = builtInTemplates.map((t, idx) => ({
  ...t,
  _id: new mongoose.Types.ObjectId(`6af6bfd130d430c5ed916f2${idx + 5}`)
}));

const testCases = [
  {
    type: 'Invoice',
    sampleText: `TAX INVOICE
Acme Tech Solutions Pvt Ltd
GSTIN: 27AABCU9603R1ZM
Bill To: Global Corp Ltd
GSTIN: 29AABCU9603R1ZN
Invoice No: INV-2026-88412
Invoice Date: 12-Nov-2026
Total Amount: INR 45,000.00
Taxable Amount: 38,135.59
CGST: 3,432.20
SGST: 3,432.20
IGST: 0.00
Items:
Laptop Stand - Qty: 10 - Rate: 3813.56 - Amount: 38135.59`,
    idKey: 'invoice_number',
    expectedId: 'INV-2026-88412'
  },
  {
    type: 'Contract or Agreement',
    sampleText: `NON-DISCLOSURE AND CONFIDENTIALITY AGREEMENT
This Agreement is entered into on 01-Jan-2026 by and between:
First Party: Alpha Technologies Inc.
Second Party: Beta Dynamics LLC
Parties agree to terms and conditions. The governing law shall be the laws of California.
Termination clause: Either party may terminate with 30 days notice.
Effective Date: 2026-01-01
End Date: 2027-01-01`,
    idKey: 'agreement_title',
    expectedId: 'NON-DISCLOSURE AND CONFIDENTIALITY AGREEMENT'
  },
  {
    type: 'Mark Sheet',
    sampleText: `SAVEETHA UNIVERSITY
STATEMENT OF MARKS
Bachelor of Technology in Computer Science & Engineering
Name: Subash G
Register Number: 2022-CSE-0941
Semester: 5th Semester
Exam Session: Nov-Dec 2026
Subjects:
CS501 - Database Systems - Marks: 88 - Grade: A+
CS502 - Operating Systems - Marks: 92 - Grade: O
Total Marks: 180
Result: PASS`,
    idKey: 'register_number',
    expectedId: '2022-CSE-0941'
  },
  {
    type: 'Lab Report',
    sampleText: `STERLING ACCURIS PATHOLOGY LABORATORY
CLINICAL BIOCHEMISTRY & DIAGNOSTIC REPORT
Patient Name: John Doe
Registration ID: 022321608971
Age / Gender: 45 Y / Male
Referring Doctor: Dr. Robert Smith, MD
Report Date: 10-Oct-2026
Test Details:
Complete Blood Count (CBC)
Hemoglobin: 14.2 g/dL (Reference: 13.0 - 17.0) Normal
WBC Count: 6800 cells/mcL (Reference: 4000 - 11000) Normal
Platelet Count: 250000 /mcL (Reference: 150000 - 450000) Normal`,
    idKey: 'patient_id',
    expectedId: '022321608971'
  },
  {
    type: 'Purchase Order',
    sampleText: `PURCHASE ORDER
Apex Industrial Supplies
PO Number: PO-2026-55901
PO Date: 15-Oct-2026
Vendor Name: Tech Hardware Warehouse
Delivery Date: 25-Oct-2026
Ship To: Acme Global Plant #4
Items:
Industrial Ethernet Cable - Qty: 50 - Rate: 200 - Amount: 10000
Total Amount: 10000.00`,
    idKey: 'po_number',
    expectedId: 'PO-2026-55901'
  }
];

async function runTests() {
  console.log('====================================================');
  console.log('TESTING ALL 5 DOCUMENT TYPES: CLASSIFICATION & ID EXTRACTION');
  console.log('====================================================\n');

  let allPassed = true;

  for (const tc of testCases) {
    console.log(`\n--- Testing [${tc.type}] ---`);

    // 1. Classification
    const classResult = await classifyDocument(tc.sampleText, mockTemplates);
    console.log(`Classification: ${classResult.templateName} (confidence: ${classResult.confidence})`);

    const typeMatch = classResult.templateName.toLowerCase() === tc.type.toLowerCase();
    if (typeMatch) {
      console.log(`✅ Classification PASSED for ${tc.type}`);
    } else {
      console.error(`❌ Classification FAILED: Expected ${tc.type}, got ${classResult.templateName}`);
      allPassed = false;
    }

    // 2. Extraction using matched template
    const tmpl = mockTemplates.find(t => t.name.toLowerCase() === tc.type.toLowerCase());
    const extracted = await extractWithLlama(tc.sampleText, tmpl);
    const extractedId = extracted[tc.idKey];

    console.log(`Extracted ${tc.idKey}: ${JSON.stringify(extractedId)}`);

    // 3. Confidence and Snippet Localization
    const scored = scoreConfidence(
      tmpl.fields,
      extracted,
      [{ pageNumber: 1, text: tc.sampleText }],
      []
    );
    const idFieldScored = scored.find(f => f.key === tc.idKey);

    console.log(`Scored ID Confidence: ${idFieldScored ? idFieldScored.confidence : 'N/A'}, snippet: "${idFieldScored ? idFieldScored.sourceText : ''}"`);

    // Verify ID matches expected or contains core ID
    if (extractedId && (String(extractedId).includes(tc.expectedId) || tc.expectedId.includes(String(extractedId)))) {
      console.log(`✅ ID Extraction PASSED for ${tc.type}: ${extractedId}`);
    } else {
      console.error(`❌ ID Extraction FAILED for ${tc.type}: Expected "${tc.expectedId}", got "${extractedId}"`);
      allPassed = false;
    }

    if (idFieldScored && idFieldScored.confidence >= 0.85) {
      console.log(`✅ ID Confidence Score PASSED (>= 0.85): ${idFieldScored.confidence}`);
    } else {
      console.warn(`⚠️ ID Confidence below 0.85: ${idFieldScored ? idFieldScored.confidence : 0}`);
    }
  }

  console.log('\n====================================================');
  if (allPassed) {
    console.log('🎉 ALL 5 TYPES CLASSIFICATION AND ID EXTRACTION PASSED!');
  } else {
    console.log('⚠️ SOME TESTS FAILED');
  }
  console.log('====================================================');
}

runTests().catch(console.error);

