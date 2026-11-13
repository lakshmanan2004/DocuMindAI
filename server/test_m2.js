const http = require('http');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const mongoose = require('mongoose');
const express = require('express');
const sharp = require('sharp');
const { Organization, User, Template, Document, DocumentPage, Extraction, Chunk, Folder } = require('./src/models');
const authRoutes = require('./src/routes/authRoutes');
const documentRoutes = require('./src/routes/documentRoutes');
const folderRoutes = require('./src/routes/folderRoutes');
const { uploadDirectory } = require('./src/middleware/upload');

async function runM2AcceptanceTests() {
  console.log('====================================================');
  console.log('       DOCUMIND MILESTONE M2 ACCEPTANCE TESTS       ');
  console.log('====================================================\n');

  let passed = 0;
  let total = 6;

  // Setup express test server
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRoutes);
  app.use('/api/folders', folderRoutes);
  app.use('/api/documents', documentRoutes);

  app.use((err, req, res, next) => {
    res.status(err.status || 500).json({ message: err.message });
  });

  const server = app.listen(0);
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}`;

  try {
    await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 5000 });
    console.log('✓ Connected to MongoDB Atlas\n');

    const rand = Math.floor(Math.random() * 100000);
    const orgAEmail = `admin_m2_a_${rand}@test.com`;
    const orgBEmail = `admin_m2_b_${rand}@test.com`;

    // Register 2 Organizations
    const regResA = await fetch(`${baseUrl}/api/auth/register-org`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orgName: `Org M2 Alpha ${rand}`,
        name: 'Admin Alpha',
        email: orgAEmail,
        password: 'Password123!'
      })
    });
    const regDataA = await regResA.json();
    const tokenA = regDataA.token;
    const orgAId = regDataA.organization.id;

    const regResB = await fetch(`${baseUrl}/api/auth/register-org`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orgName: `Org M2 Beta ${rand}`,
        name: 'Admin Beta',
        email: orgBEmail,
        password: 'Password123!'
      })
    });
    const regDataB = await regResB.json();
    const tokenB = regDataB.token;

    // Generate real valid test buffers
    // 1. PDF
    const validPdfBuffer = Buffer.from(
      '%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>\nendobj\nxref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \ntrailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n190\n%%EOF'
    );
    // 2. Real valid PNG using sharp
    const validPngBuffer = await sharp({
      create: { width: 50, height: 50, channels: 3, background: { r: 255, g: 255, b: 255 } }
    }).png().toBuffer();
    // 3. Real valid JPEG using sharp
    const validJpgBuffer = await sharp({
      create: { width: 50, height: 50, channels: 3, background: { r: 255, g: 255, b: 255 } }
    }).jpeg().toBuffer();
    // 4. Invalid file
    const fakePdfBuffer = Buffer.from('PLAIN TEXT FILE WITH NO PDF SIGNATURE');

    // ----------------------------------------------------
    // Test 1: Wrong File Type & Corrupt Signature Rejection
    // ----------------------------------------------------
    console.log('1. Testing Wrong File Type & Corrupted Signature Rejection...');
    const fakeFormData = new FormData();
    fakeFormData.append('file', new Blob([fakePdfBuffer], { type: 'application/pdf' }), 'corrupt.pdf');

    const fakeUploadRes = await fetch(`${baseUrl}/api/documents`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: fakeFormData
    });
    const fakeUploadData = await fakeUploadRes.json();

    if (fakeUploadRes.status === 400 && fakeUploadData.message.includes('signature')) {
      console.log('   ✓ File with corrupt/mismatched magic bytes rejected with 400.');
      passed++;
    } else {
      console.error('   ✗ Expected 400 for corrupt signature, got:', fakeUploadRes.status, fakeUploadData);
    }

    // ----------------------------------------------------
    // Test 2: Upload 5 Mixed Valid Files (PDF, PNG, JPG)
    // ----------------------------------------------------
    console.log('\n2. Testing Multi-Upload of 5 Mixed Valid Files (2 PDF, 2 PNG, 1 JPG)...');
    const multiFormData = new FormData();
    multiFormData.append('files', new Blob([validPdfBuffer], { type: 'application/pdf' }), 'invoice_sample_1.pdf');
    multiFormData.append('files', new Blob([validPdfBuffer], { type: 'application/pdf' }), 'contract_sample_2.pdf');
    multiFormData.append('files', new Blob([validPngBuffer], { type: 'image/png' }), 'marksheet_scan_3.png');
    multiFormData.append('files', new Blob([validPngBuffer], { type: 'image/png' }), 'lab_report_scan_4.png');
    multiFormData.append('files', new Blob([validJpgBuffer], { type: 'image/jpeg' }), 'po_camera_5.jpg');

    const multiRes = await fetch(`${baseUrl}/api/documents`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: multiFormData
    });
    const multiData = await multiRes.json();

    let uploadedDocIds = [];
    if (multiRes.status === 201 && multiData.documents && multiData.documents.length === 5) {
      uploadedDocIds = multiData.documents.map(d => d._id);
      console.log(`   ✓ Successfully uploaded and queued 5 mixed files (${uploadedDocIds.length} docs).`);
      passed++;
    } else {
      console.error('   ✗ Failed multi-upload:', multiRes.status, multiData);
    }

    // ----------------------------------------------------
    // Test 3: Folders CRUD & Moving Documents to "No folder"
    // ----------------------------------------------------
    console.log('\n3. Testing Single-Level Folders (Create, Rename, Delete & Move to No Folder)...');
    const createFolderRes = await fetch(`${baseUrl}/api/folders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`
      },
      body: JSON.stringify({ name: 'Financial Records 2026' })
    });
    const folderData = await createFolderRes.json();
    const folderId = folderData.folder._id;

    const renameRes = await fetch(`${baseUrl}/api/folders/${folderId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`
      },
      body: JSON.stringify({ name: 'Accounts & Taxes' })
    });
    const renameData = await renameRes.json();

    // Assign one doc to this folder
    await Document.updateOne({ _id: uploadedDocIds[0] }, { folderId });

    // Delete folder
    const deleteFolderRes = await fetch(`${baseUrl}/api/folders/${folderId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    const deleteFolderData = await deleteFolderRes.json();

    // Check that doc was reset to folderId: null
    const docAfterFolderDelete = await Document.findById(uploadedDocIds[0]);

    if (
      createFolderRes.status === 201 &&
      renameRes.status === 200 &&
      renameData.folder.name === 'Accounts & Taxes' &&
      deleteFolderRes.status === 200 &&
      docAfterFolderDelete.folderId === null
    ) {
      console.log('   ✓ Folder CRUD verified; documents automatically moved to "No folder".');
      passed++;
    } else {
      console.error('   ✗ Folder operations failed:', deleteFolderData);
    }

    // ----------------------------------------------------
    // Test 4: Library Filters & Search
    // ----------------------------------------------------
    console.log('\n4. Testing Library Filters (Status, DocType, Search)...');
    const searchRes = await fetch(`${baseUrl}/api/documents?q=marksheet`, {
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    const searchData = await searchRes.json();

    // By the time this check runs, the worker has processed the documents into 'needs_review' or 'completed'
    const statusFilterRes = await fetch(`${baseUrl}/api/documents?status=needs_review`, {
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    const statusData = await statusFilterRes.json();

    if (searchData.documents.length === 1 && statusData.documents.length >= 5) {
      console.log(`   ✓ Search filtered correctly (${searchData.documents[0].originalName})`);
      console.log(`   ✓ Status filter returned ${statusData.documents.length} processed documents.`);
      passed++;
    } else {
      console.error('   ✗ Filters failed:', searchData.documents.length, statusData.documents.length);
    }

    // ----------------------------------------------------
    // Test 5: Authenticated File Preview & Tenant Isolation
    // ----------------------------------------------------
    console.log('\n5. Testing Authenticated File Stream Preview & Isolation...');
    const previewResA = await fetch(`${baseUrl}/api/documents/${uploadedDocIds[0]}/file`, {
      headers: { Authorization: `Bearer ${tokenA}` }
    });

    const previewResB = await fetch(`${baseUrl}/api/documents/${uploadedDocIds[0]}/file`, {
      headers: { Authorization: `Bearer ${tokenB}` }
    });

    if (previewResA.status === 200 && previewResB.status === 404) {
      console.log('   ✓ File streamed with Content-Type:', previewResA.headers.get('content-type'));
      console.log('   ✓ Org B correctly received 404 for Org A document file (Strict Tenant Isolation).');
      passed++;
    } else {
      console.error(`   ✗ Preview check failed: OrgA=${previewResA.status}, OrgB=${previewResB.status}`);
    }

    // ----------------------------------------------------
    // Test 6: Delete Removes Everything (File, Pages, Chunks, Extraction)
    // ----------------------------------------------------
    console.log('\n6. Testing Cascade Deletion (Physical File, DB Record, Pages, Chunks, Extractions)...');
    const targetDoc = await Document.findById(uploadedDocIds[1]);
    const filePath = path.join(uploadDirectory, targetDoc.filePath);

    // Verify document records exist before deletion
    const beforePages = await DocumentPage.countDocuments({ documentId: targetDoc._id });
    const beforeChunks = await Chunk.countDocuments({ documentId: targetDoc._id });
    const beforeExtractions = await Extraction.countDocuments({ documentId: targetDoc._id });
    console.log(`   Before delete: Pages=${beforePages}, Chunks=${beforeChunks}, Extractions=${beforeExtractions}`);

    const deleteDocRes = await fetch(`${baseUrl}/api/documents/${targetDoc._id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenA}` }
    });

    const fileStillExists = fs.existsSync(filePath);
    const docStillExists = await Document.findById(targetDoc._id);
    const pagesCount = await DocumentPage.countDocuments({ documentId: targetDoc._id });
    const chunksCount = await Chunk.countDocuments({ documentId: targetDoc._id });
    const extractionsCount = await Extraction.countDocuments({ documentId: targetDoc._id });

    if (
      deleteDocRes.status === 200 &&
      !fileStillExists &&
      !docStillExists &&
      pagesCount === 0 &&
      chunksCount === 0 &&
      extractionsCount === 0
    ) {
      console.log('   ✓ Cascade delete verified: Physical file, document, pages, chunks, and extractions completely erased.');
      passed++;
    } else {
      console.error('   ✗ Cascade delete failed:', {
        status: deleteDocRes.status,
        fileStillExists,
        docStillExists: !!docStillExists,
        pagesCount,
        chunksCount,
        extractionsCount
      });
    }

    // Clean up remaining test data
    for (const id of uploadedDocIds) {
      const doc = await Document.findById(id);
      if (doc) {
        const p = path.join(uploadDirectory, doc.filePath);
        if (fs.existsSync(p)) fs.unlinkSync(p);
      }
    }
    await Document.deleteMany({ orgId: { $in: [orgAId, regDataB.organization.id] } });
    await Folder.deleteMany({ orgId: { $in: [orgAId, regDataB.organization.id] } });
    await User.deleteMany({ orgId: { $in: [orgAId, regDataB.organization.id] } });
    await Template.deleteMany({ orgId: { $in: [orgAId, regDataB.organization.id] } });
    await Organization.deleteMany({ _id: { $in: [orgAId, regDataB.organization.id] } });

  } catch (err) {
    console.error('Fatal M2 test error:', err);
  } finally {
    server.close();
    await mongoose.disconnect();
  }

  console.log('\n====================================================');
  console.log(` M2 ACCEPTANCE RESULTS: ${passed}/${total} TESTS PASSED`);
  console.log('====================================================');

  process.exit(passed === total ? 0 : 1);
}

runM2AcceptanceTests();
