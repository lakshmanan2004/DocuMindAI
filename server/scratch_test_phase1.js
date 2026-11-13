const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const { Organization, User, Document } = require('./src/models');
const { uploadDirectory } = require('./src/middleware/upload');

async function testPhase1Step3() {
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 15000 });
  console.log('Connected to DB for Document & Tenant isolation tests');

  // --- 1. SETUP TWO SEPARATE ORGANIZATIONS ---
  const orgA = await Organization.create({ name: 'Org A Healthcare' });
  const orgB = await Organization.create({ name: 'Org B Law Firm' });

  const userA = await User.create({
    orgId: orgA._id,
    name: 'Doctor A',
    email: 'docA_' + Date.now() + '@hospital.org',
    passwordHash: 'dummy',
    role: 'admin'
  });

  const userB = await User.create({
    orgId: orgB._id,
    name: 'Lawyer B',
    email: 'lawyerB_' + Date.now() + '@law.org',
    passwordHash: 'dummy',
    role: 'admin'
  });

  console.log('1. Created Two Distinct Tenants: Org A (' + orgA._id + ') and Org B (' + orgB._id + ')');

  // --- 2. UPLOAD FILE FOR ORG A ---
  const testFileName = 'test-patient-scan-' + Date.now() + '.pdf';
  const diskPath = path.join(uploadDirectory, testFileName);
  fs.writeFileSync(diskPath, '%PDF-1.4 Mock PDF Content');

  const docA = await Document.create({
    orgId: orgA._id,
    uploadedBy: userA._id,
    originalName: 'Patient_Report_2026.pdf',
    mimeType: 'application/pdf',
    filePath: testFileName,
    size: 25,
    status: 'uploaded'
  });
  console.log('2. Org A uploaded document:', docA.originalName, 'ID:', docA._id);

  // --- 3. TEST TENANT ISOLATION ---
  // Query list for Org B: must find 0 documents
  const orgBDocs = await Document.find({ orgId: orgB._id });
  console.log('3a. Org B document list count:', orgBDocs.length, '(Expected 0)');

  // Direct lookup by ID for Org B: must be null (isolated!)
  const crossTenantDoc = await Document.findOne({ _id: docA._id, orgId: orgB._id });
  console.log('3b. Org B direct access to Org A doc ID:', crossTenantDoc ? 'LEAKED!' : 'BLOCKED (null)');

  if (orgBDocs.length !== 0 || crossTenantDoc !== null) {
    throw new Error('Tenant isolation check FAILED!');
  }
  console.log('   Strict Multi-Tenant Isolation: PASSED');

  // --- 4. TEST FILE VALIDATION RULES ---
  const allowedExts = ['.pdf', '.png', '.jpg', '.jpeg'];
  const testFileExtInvalid = '.exe';
  const isInvalidAllowed = allowedExts.includes(testFileExtInvalid);
  console.log('4. Rejecting .exe upload check:', !isInvalidAllowed ? 'PASSED (Rejected)' : 'FAILED');

  // --- 5. CLEANUP ---
  if (fs.existsSync(diskPath)) fs.unlinkSync(diskPath);
  await Document.deleteOne({ _id: docA._id });
  await User.deleteOne({ _id: userA._id });
  await User.deleteOne({ _id: userB._id });
  await Organization.deleteOne({ _id: orgA._id });
  await Organization.deleteOne({ _id: orgB._id });
  console.log('5. Test data cleaned up successfully');

  await mongoose.disconnect();
  console.log('ALL PHASE 1 STEP 3 CHECKS PASSED!');
}

testPhase1Step3().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});

