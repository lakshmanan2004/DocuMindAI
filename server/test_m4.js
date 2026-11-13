const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const { Organization, User, Template, Document } = require('./src/models');
const { validateRules } = require('./src/services/validate');

const BASE_URL = process.env.API_URL || 'http://localhost:5000/api';

async function runM4Tests() {
  console.log('=== [M4] Starting Template Engine & Built-In Document Types Acceptance Tests ===\n');

  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB Atlas');

  let passed = 0;
  let total = 0;

  try {
    // ---------------------------------------------------------
    // Test 1: New org receives 5 built-in templates
    // ---------------------------------------------------------
    total++;
    console.log(`[Test ${total}] Registering new org and verifying 5 built-in templates are seeded...`);
    const timestamp = Date.now();
    const regRes = await fetch(`${BASE_URL}/auth/register-org`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orgName: `TemplateCorp ${timestamp}`,
        name: 'Admin Tester',
        email: `admin_${timestamp}@templatecorp.com`,
        password: 'Password123!'
      })
    });
    const regData = await regRes.json();
    if (!regRes.ok) throw new Error(`Registration failed: ${JSON.stringify(regData)}`);

    const token = regData.token;
    const orgId = regData.organization.id;

    // Fetch templates
    const listRes = await fetch(`${BASE_URL}/templates`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const listData = await listRes.json();

    if (!listRes.ok) throw new Error(`Fetch templates failed: ${JSON.stringify(listData)}`);

    const templateNames = listData.templates.map((t) => t.name);
    console.log(`  Fetched ${listData.templates.length} templates:`, templateNames);

    const expectedNames = [
      'Invoice',
      'Contract or Agreement',
      'Mark Sheet',
      'Lab Report',
      'Purchase Order'
    ];

    const allExist = expectedNames.every((name) => templateNames.includes(name));
    if (listData.templates.length >= 5 && allExist) {
      console.log('  PASS: All 5 built-in templates successfully seeded for new organization.');
      passed++;
    } else {
      throw new Error(`Missing expected templates. Got: ${templateNames.join(', ')}`);
    }

    // ---------------------------------------------------------
    // Test 2: Builder creates custom template with table field & rules
    // ---------------------------------------------------------
    total++;
    console.log(`\n[Test ${total}] Creating custom template with table field & validation rules...`);
    const customTemplatePayload = {
      name: `Equipment Maintenance Audit ${timestamp}`,
      description: 'Quarterly field inspection and parts replacement log',
      keywords: ['audit', 'equipment', 'maintenance', 'parts'],
      fields: [
        { key: 'technician', label: 'Technician Name', type: 'string', required: true },
        { key: 'inspection_date', label: 'Inspection Date', type: 'date', required: true },
        {
          key: 'parts_replaced',
          label: 'Parts Replaced',
          type: 'table',
          columns: [
            { key: 'part_name', label: 'Part Name', type: 'string' },
            { key: 'qty', label: 'Quantity', type: 'number' },
            { key: 'unit_price', label: 'Unit Price', type: 'number' },
            { key: 'amount', label: 'Amount', type: 'number' }
          ]
        },
        { key: 'total_cost', label: 'Total Cost', type: 'number', required: true }
      ],
      rules: [
        {
          type: 'required',
          field: 'technician',
          message: 'Technician name is required',
          severity: 'error'
        },
        {
          type: 'table_sum_equals',
          table: 'parts_replaced',
          column: 'amount',
          target: 'total_cost',
          tolerance: 0.5,
          message: 'Sum of parts amounts must equal total cost',
          severity: 'error'
        }
      ]
    };

    const createRes = await fetch(`${BASE_URL}/templates`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(customTemplatePayload)
    });
    const createData = await createRes.json();

    if (createRes.status === 201 && createData.template && createData.template.fields.length === 4) {
      console.log('  PASS: Custom template with table field and rules created successfully.');
      passed++;
    } else {
      throw new Error(`Failed to create custom template: ${JSON.stringify(createData)}`);
    }

    const createdTemplateId = createData.template._id;

    // ---------------------------------------------------------
    // Test 3: Duplicate template
    // ---------------------------------------------------------
    total++;
    console.log(`\n[Test ${total}] Testing duplicate template endpoint...`);
    const dupRes = await fetch(`${BASE_URL}/templates/${createdTemplateId}/duplicate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` }
    });
    const dupData = await dupRes.json();

    if (dupRes.status === 201 && dupData.template.name.includes('(Copy)')) {
      console.log(`  PASS: Template duplicated successfully as "${dupData.template.name}".`);
      passed++;
    } else {
      throw new Error(`Failed to duplicate template: ${JSON.stringify(dupData)}`);
    }

    // ---------------------------------------------------------
    // Test 4: Test Box sandbox returns JSON & validation issues without saving to DB
    // ---------------------------------------------------------
    total++;
    console.log(`\n[Test ${total}] Testing Test Box sandbox (no DB persistence)...`);
    const sampleText = `
      EQUIPMENT INSPECTION AUDIT
      Technician: Sarah Connor
      Inspection Date: 2026-11-13
      
      Parts Replaced:
      - Motor Belt: Qty 2, Unit 50, Amount 100
      - Hydraulic Oil: Qty 1, Unit 75, Amount 75
      
      Total Cost: 175.00
    `;

    // Count DB documents before test box run
    const docsCountBefore = await Document.countDocuments({ orgId });

    const testRes = await fetch(`${BASE_URL}/templates/test`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        templateId: createdTemplateId,
        text: sampleText
      })
    });
    const testData = await testRes.json();

    const docsCountAfter = await Document.countDocuments({ orgId });

    if (
      testRes.ok &&
      testData.extracted !== undefined &&
      Array.isArray(testData.validationIssues) &&
      docsCountBefore === docsCountAfter
    ) {
      console.log('  Extracted payload preview:', testData.extracted);
      console.log('  Validation issues:', testData.validationIssues);
      console.log('  PASS: Test Box executed, validated rules, and persisted zero documents.');
      passed++;
    } else {
      throw new Error(`Test Box failed: ${JSON.stringify(testData)}`);
    }

    // ---------------------------------------------------------
    // Test 5: Delete template in use is blocked with 409 Conflict
    // ---------------------------------------------------------
    total++;
    console.log(`\n[Test ${total}] Testing delete-in-use protection (409 Conflict)...`);

    // Create a mock document using this template
    const doc = await Document.create({
      orgId,
      templateId: createdTemplateId,
      originalName: 'Active Maintenance Report.pdf',
      mimeType: 'application/pdf',
      filePath: 'uploads/mock_report.pdf',
      size: 1024,
      status: 'completed',
      uploadedBy: regData.user.id
    });

    // Try deleting template
    const deleteBlockedRes = await fetch(`${BASE_URL}/templates/${createdTemplateId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    });
    const deleteBlockedData = await deleteBlockedRes.json();

    if (deleteBlockedRes.status === 409 && deleteBlockedData.message.includes('in use by documents')) {
      console.log('  PASS: Deletion successfully blocked with 409 Conflict.');
      passed++;
    } else {
      throw new Error(`Expected 409 Conflict, got ${deleteBlockedRes.status}: ${JSON.stringify(deleteBlockedData)}`);
    }

    // Now remove document and confirm deletion succeeds
    total++;
    console.log(`\n[Test ${total}] Deleting template after document reference removed...`);
    await Document.deleteOne({ _id: doc._id });

    const deleteSuccessRes = await fetch(`${BASE_URL}/templates/${createdTemplateId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    });
    const deleteSuccessData = await deleteSuccessRes.json();

    if (deleteSuccessRes.status === 200) {
      console.log('  PASS: Template successfully deleted when no longer in use.');
      passed++;
    } else {
      throw new Error(`Expected 200, got ${deleteSuccessRes.status}: ${JSON.stringify(deleteSuccessData)}`);
    }

    console.log(`\n=================================================`);
    console.log(`M4 ACCEPTANCE SUMMARY: ${passed}/${total} TESTS PASSED`);
    console.log(`=================================================`);
  } catch (err) {
    console.error('\nFAIL: M4 Test Suite encountered an error:', err.message);
  } finally {
    await mongoose.disconnect();
    process.exit(passed === total ? 0 : 1);
  }
}

runM4Tests();
