const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

dotenv.config({ path: path.join(__dirname, '.env') });

const { Organization, User, Template, Document, DocumentPage, Folder, Chunk } = require('./src/models');
const { processDocument } = require('./src/queues/processor');
const { uploadDirectory } = require('./src/middleware/upload');

const BASE_URL = process.env.API_URL || 'http://localhost:5000/api';

async function runM6Tests() {
  console.log('=== [M6] Starting Chat (RAG) & Hybrid Search Acceptance Tests ===\n');

  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB Atlas');

  let passed = 0;
  let total = 0;

  try {
    const timestamp = Date.now();

    // ---------------------------------------------------------
    // 1. Setup Tenant A
    // ---------------------------------------------------------
    const regResA = await fetch(`${BASE_URL}/auth/register-org`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orgName: `TenantA_${timestamp}`,
        name: 'Alice Admin',
        email: `alice_${timestamp}@tenanta.com`,
        password: 'Password123!'
      })
    });
    const regDataA = await regResA.json();
    if (!regResA.ok) throw new Error(`Tenant A registration failed: ${JSON.stringify(regDataA)}`);
    const tokenA = regDataA.token;
    const orgIdA = regDataA.organization.id;
    const userIdA = regDataA.user.id;

    // ---------------------------------------------------------
    // 2. Setup Tenant B (for cross-tenant leakage testing)
    // ---------------------------------------------------------
    const regResB = await fetch(`${BASE_URL}/auth/register-org`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orgName: `TenantB_${timestamp}`,
        name: 'Bob Admin',
        email: `bob_${timestamp}@tenantb.com`,
        password: 'Password123!'
      })
    });
    const regDataB = await regResB.json();
    if (!regResB.ok) throw new Error(`Tenant B registration failed: ${JSON.stringify(regDataB)}`);
    const tokenB = regDataB.token;
    const orgIdB = regDataB.organization.id;

    // Helper: create a real text fixture file and process it
    if (!fs.existsSync(uploadDirectory)) {
      fs.mkdirSync(uploadDirectory, { recursive: true });
    }

    const createAndProcessDoc = async ({ orgId, uploadedBy, filename, content, folderId = null }) => {
      const filePath = `m6_${timestamp}_${filename}`;
      const fullPath = path.join(uploadDirectory, filePath);
      fs.writeFileSync(fullPath, content, 'utf8');

      const doc = await Document.create({
        orgId,
        uploadedBy,
        originalName: filename,
        fileName: filePath,
        filePath: filePath,
        mimeType: 'text/plain',
        size: Buffer.byteLength(content, 'utf8'),
        status: 'queued',
        folderId: folderId || null
      });

      await processDocument(doc._id);
      return doc;
    };

    // Create a folder in Tenant A
    const folderA = await Folder.create({
      orgId: orgIdA,
      name: 'Contracts Folder',
      color: '#6366f1',
      createdBy: userIdA
    });

    console.log('\nIngesting fixture documents for Tenant A...');
    // Doc 1: Tax Invoice in Tenant A
    const invoiceDocA = await createAndProcessDoc({
      orgId: orgIdA,
      uploadedBy: userIdA,
      filename: 'acme_invoice_7788.txt',
      content: `TAX INVOICE
Invoice Number: ACME-7788
Invoice Date: 2026-10-15
Supplier: Acme Industrial Supplies Ltd
GSTIN: 27AABCA1234A1Z5
Buyer: TechNova Solutions Pvt Ltd
GSTIN: 29XYZPA5678B1Z2

Item: Heavy Duty Industrial Air Compressor
Qty: 2
Rate: 15000.00
Taxable Amount: 30000.00
CGST 9%: 2700.00
SGST 9%: 2700.00
Grand Total: 35400.00
Amount in Words: Thirty Five Thousand Four Hundred Rupees Only`
    });

    // Doc 2: Service Agreement in Tenant A (inside folder)
    const agreementDocA = await createAndProcessDoc({
      orgId: orgIdA,
      uploadedBy: userIdA,
      filename: 'master_services_agreement.txt',
      content: `MASTER SERVICES AGREEMENT
Effective Date: 2026-01-01
End Date: 2027-12-31
Parties:
1. First Party: Alpha Cloud Systems Inc
2. Second Party: Beta Logistics Global Corp

Term: 24 Months
Governing Law: Jurisdiction of California, United States
Payment Terms: Net 30 days upon invoice receipt
Termination: 60 days written notice by either party`,
      folderId: folderA._id
    });

    // Doc 3: Secret Document in Tenant B
    const secretDocB = await createAndProcessDoc({
      orgId: orgIdB,
      uploadedBy: regDataB.user.id,
      filename: 'tenant_b_confidential_formula.txt',
      content: `CONFIDENTIAL FORMULA - TOP SECRET
Tenant B Chemical Compound Quantum-X99
Formula Ratio: 42 parts Hydrogen, 17 parts Xenon.
Authorized Personnel: Bob Admin Only.
Do Not Disclose Outside Tenant B.`
    });

    console.log('Ingestion complete.\n');

    // ---------------------------------------------------------
    // Test 1: RAG Question with Citations
    // ---------------------------------------------------------
    total++;
    console.log('[Test 1] Testing Chat RAG Question Answering & Citations...');
    const chatRes1 = await fetch(`${BASE_URL}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`
      },
      body: JSON.stringify({
        question: 'What is the grand total and invoice number of the Acme Industrial Supplies invoice?'
      })
    });
    const chatData1 = await chatRes1.json();
    console.log(`  AI Answer: "${chatData1.answer}"`);
    console.log(`  Sources returned: ${chatData1.sources?.length || 0}`);

    const hasInvoiceNumber = chatData1.answer.includes('ACME-7788');
    const hasAmount = /35[,.]?400|3,54/.test(chatData1.answer);
    const hasCitation = chatData1.answer.includes('[1]');

    if (
      chatRes1.ok &&
      chatData1.answer &&
      (hasInvoiceNumber || hasAmount) &&
      hasCitation &&
      chatData1.sources &&
      chatData1.sources.length > 0 &&
      chatData1.sources[0].documentName.includes('acme_invoice_7788')
    ) {
      console.log('  PASS: Chat correctly extracted answer and cited source.\n');
      passed++;
    } else {
      console.error('  FAIL: Chat failed to answer with citations properly.\n');
    }

    // ---------------------------------------------------------
    // Test 2: Exact Fallback Sentence on Absent Content
    // ---------------------------------------------------------
    total++;
    console.log('[Test 2] Testing Exact Fallback Sentence ("I could not find this in your documents.")...');
    const chatRes2 = await fetch(`${BASE_URL}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`
      },
      body: JSON.stringify({
        question: 'What is the surface temperature and atmospheric pressure on Planet Saturn?'
      })
    });
    const chatData2 = await chatRes2.json();
    console.log(`  AI Answer: "${chatData2.answer}"`);

    if (
      chatRes2.ok &&
      chatData2.answer &&
      chatData2.answer.includes('I could not find this in your documents.')
    ) {
      console.log('  PASS: Exact fallback sentence returned for out-of-context query.\n');
      passed++;
    } else {
      console.error(`  FAIL: Expected exact fallback sentence, got: "${chatData2.answer}"\n`);
    }

    // ---------------------------------------------------------
    // Test 3: Zero Cross-Tenant Data Leakage
    // ---------------------------------------------------------
    total++;
    console.log('[Test 3] Testing Cross-Tenant Isolation (Tenant A querying Tenant B secret)...');
    const chatRes3 = await fetch(`${BASE_URL}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`
      },
      body: JSON.stringify({
        question: 'What is the formula ratio for Quantum-X99?'
      })
    });
    const chatData3 = await chatRes3.json();
    console.log(`  Tenant A AI Answer: "${chatData3.answer}"`);

    // Ensure Tenant A got fallback and ZERO sources from Tenant B
    const leakedB = (chatData3.sources || []).some((s) => s.documentName.includes('tenant_b'));
    if (
      chatRes3.ok &&
      chatData3.answer.includes('I could not find this in your documents.') &&
      !leakedB
    ) {
      console.log('  PASS: Tenant isolation verified. Zero cross-tenant data leakage.\n');
      passed++;
    } else {
      console.error('  FAIL: Tenant isolation breached! Tenant B data was exposed.\n');
    }

    // ---------------------------------------------------------
    // Test 4: Scoped Chat (Document-scoped & Folder-scoped)
    // ---------------------------------------------------------
    total++;
    console.log('[Test 4] Testing Scoped Chat (Folder scope vs Document scope)...');
    // Querying with folderId should only search the agreement doc inside that folder
    const folderChatRes = await fetch(`${BASE_URL}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`
      },
      body: JSON.stringify({
        question: 'What is the governing law of the agreement?',
        folderId: folderA._id.toString()
      })
    });
    const folderChatData = await folderChatRes.json();
    console.log(`  Folder-scoped Answer: "${folderChatData.answer}"`);

    const allSourcesInFolder = (folderChatData.sources || []).every(
      (s) => s.documentName === 'master_services_agreement.txt'
    );

    if (
      folderChatRes.ok &&
      folderChatData.answer.toLowerCase().includes('california') &&
      allSourcesInFolder
    ) {
      console.log('  PASS: Folder-scoped chat constrained retrieval strictly to folder documents.\n');
      passed++;
    } else {
      console.error('  FAIL: Folder-scoped chat retrieval failed.\n');
    }

    // ---------------------------------------------------------
    // Test 5: Hybrid Search Endpoint (/api/search)
    // ---------------------------------------------------------
    total++;
    console.log('[Test 5] Testing Hybrid Search Endpoint (/api/search)...');
    const searchRes = await fetch(`${BASE_URL}/search?q=Industrial+Air+Compressor`, {
      headers: {
        Authorization: `Bearer ${tokenA}`
      }
    });
    const searchData = await searchRes.json();
    console.log(`  Search results count: ${searchData.total}`);
    if (searchData.results && searchData.results.length > 0) {
      const topResult = searchData.results[0];
      console.log(`  Top hit: "${topResult.documentName}" (Score: ${topResult.score}, Semantic: ${topResult.semanticScore}, Keyword: ${topResult.keywordScore})`);
    }

    if (
      searchRes.ok &&
      searchData.total > 0 &&
      searchData.results[0].documentName.includes('acme_invoice_7788') &&
      searchData.results[0].score > 0
    ) {
      console.log('  PASS: Hybrid search ranked semantic + keyword results with metadata.\n');
      passed++;
    } else {
      console.error('  FAIL: Hybrid search did not return expected ranked results.\n');
    }

  } catch (err) {
    console.error('Unhandled error in M6 test run:', err);
  } finally {
    console.log('=================================================');
    console.log(`M6 ACCEPTANCE SUMMARY: ${passed}/${total} TESTS PASSED`);
    console.log('=================================================');
    await mongoose.disconnect();
    process.exit(passed === total ? 0 : 1);
  }
}

runM6Tests();
