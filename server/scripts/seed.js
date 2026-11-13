const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { Organization, User, Template, Document, DocumentPage, Extraction, Chunk, AuditLog } = require('../src/models');
const { embedTexts } = require('../src/services/embed');

async function seed() {
  console.log('====================================================');
  console.log('       DOCUMIND AI — AUTOMATED DEMO SEED SCRIPT     ');
  console.log('====================================================');

  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✓ Connected to MongoDB Atlas');

    // 1. Create or Find Demo Organization
    const orgName = 'Acme Global Enterprise';
    let org = await Organization.findOne({ name: orgName });
    if (!org) {
      org = await Organization.create({ name: orgName });
      console.log(`✓ Created Organization: "${org.name}" (ID: ${org._id})`);
    } else {
      console.log(`✓ Found Existing Organization: "${org.name}" (ID: ${org._id})`);
    }

    const salt = await bcrypt.genSalt(10);
    const demoPassword = 'Password123!';
    const passwordHash = await bcrypt.hash(demoPassword, salt);

    // 2. Seed 4-Tier RBAC Users
    const demoUsers = [
      {
        name: 'Alex Mercer (Admin)',
        email: 'admin@acme.com',
        role: 'admin',
        orgId: org._id,
        passwordHash,
        isActive: true
      },
      {
        name: 'Priya Sharma (Reviewer)',
        email: 'reviewer@acme.com',
        role: 'reviewer',
        orgId: org._id,
        passwordHash,
        isActive: true
      },
      {
        name: 'Karthik Rajan (Employee)',
        email: 'employee@acme.com',
        role: 'employee',
        orgId: org._id,
        passwordHash,
        isActive: true
      },
      {
        name: 'Anita Desai (Viewer)',
        email: 'viewer@acme.com',
        role: 'viewer',
        orgId: org._id,
        passwordHash,
        isActive: true
      }
    ];

    const userMap = {};
    for (const u of demoUsers) {
      let existing = await User.findOne({ email: u.email });
      if (existing) {
        existing.orgId = org._id;
        existing.role = u.role;
        existing.passwordHash = passwordHash;
        existing.name = u.name;
        await existing.save();
        userMap[u.role] = existing;
        console.log(`  Updated demo user: ${u.email} [${u.role.toUpperCase()}]`);
      } else {
        const created = await User.create(u);
        userMap[u.role] = created;
        console.log(`  Created demo user: ${u.email} [${u.role.toUpperCase()}]`);
      }
    }

    // 3. Seed Default Extraction Templates
    const invoiceTemplateData = {
      orgId: org._id,
      name: 'Standard Commercial Invoice',
      createdBy: userMap.admin._id,
      fields: [
        { key: 'invoice_number', label: 'Invoice Number', type: 'string', required: true, hint: 'Invoice / Bill Reference Number' },
        { key: 'invoice_date', label: 'Invoice Date', type: 'date', required: true, hint: 'Date of invoice issue' },
        { key: 'vendor_name', label: 'Vendor / Seller Name', type: 'string', required: true, hint: 'Name of supplying company' },
        { key: 'vendor_gstin', label: 'GSTIN / Tax ID', type: 'string', required: false, hint: '15-digit GSTIN or Tax Identifier' },
        { key: 'total_amount', label: 'Total Amount (₹)', type: 'number', required: true, hint: 'Final gross invoice payable amount' },
        { key: 'tax_amount', label: 'Tax Amount (₹)', type: 'number', required: false, hint: 'Total calculated GST/tax' }
      ]
    };

    let invoiceTemplate = await Template.findOne({ orgId: org._id, name: invoiceTemplateData.name });
    if (!invoiceTemplate) {
      invoiceTemplate = await Template.create(invoiceTemplateData);
      console.log(`✓ Seeded Template: "${invoiceTemplate.name}"`);
    } else {
      console.log(`✓ Template exists: "${invoiceTemplate.name}"`);
    }

    const ndaTemplateData = {
      orgId: org._id,
      name: 'Non-Disclosure Agreement (NDA)',
      createdBy: userMap.admin._id,
      fields: [
        { key: 'party_a', label: 'Disclosing Party', type: 'string', required: true, hint: 'Organization sharing confidential data' },
        { key: 'party_b', label: 'Receiving Party', type: 'string', required: true, hint: 'Recipient organization or contractor' },
        { key: 'effective_date', label: 'Effective Date', type: 'date', required: true, hint: 'Commencement date of agreement' },
        { key: 'term_months', label: 'Term (Months)', type: 'number', required: false, hint: 'Validity period in months' },
        { key: 'jurisdiction', label: 'Governing Law', type: 'string', required: false, hint: 'Applicable courts and jurisdiction' }
      ]
    };

    let ndaTemplate = await Template.findOne({ orgId: org._id, name: ndaTemplateData.name });
    if (!ndaTemplate) {
      ndaTemplate = await Template.create(ndaTemplateData);
      console.log(`✓ Seeded Template: "${ndaTemplate.name}"`);
    } else {
      console.log(`✓ Template exists: "${ndaTemplate.name}"`);
    }

    // 4. Seed 10 Processed Documents for Acme Global Enterprise
    const currentDocCount = await Document.countDocuments({ orgId: org._id });
    console.log(`Current Acme documents in DB: ${currentDocCount}`);

    if (currentDocCount < 10) {
      console.log('Seeding demo processed documents to reach 10 total...');

      // Find existing processed documents from other orgs to clone real content
      const sourceDocs = await Document.find({
        status: { $in: ['completed', 'needs_review', 'reviewed'] }
      }).limit(6);

      for (const src of sourceDocs) {
        const alreadyCloned = await Document.findOne({ orgId: org._id, originalName: src.originalName });
        if (!alreadyCloned) {
          const newDoc = await Document.create({
            orgId: org._id,
            uploadedBy: userMap.employee._id,
            originalName: src.originalName,
            mimeType: src.mimeType,
            filePath: src.filePath,
            size: src.size,
            templateId: invoiceTemplate._id,
            status: src.status === 'uploaded' ? 'completed' : src.status,
            pageCount: src.pageCount || 1,
            createdAt: new Date(Date.now() - Math.floor(Math.random() * 86400000 * 5))
          });

          // Clone pages
          const srcPages = await DocumentPage.find({ documentId: src._id });
          for (const sp of srcPages) {
            await DocumentPage.create({
              orgId: org._id,
              documentId: newDoc._id,
              pageNumber: sp.pageNumber,
              text: sp.text,
              ocrConfidence: sp.ocrConfidence
            });
          }

          // Clone extraction
          const srcExt = await Extraction.findOne({ documentId: src._id });
          if (srcExt) {
            await Extraction.create({
              orgId: org._id,
              documentId: newDoc._id,
              templateId: invoiceTemplate._id,
              fields: srcExt.fields,
              validationIssues: srcExt.validationIssues || [],
              reviewedBy: userMap.reviewer._id,
              reviewedAt: new Date()
            });
          }

          // Clone chunks
          const srcChunks = await Chunk.find({ documentId: src._id });
          for (const sc of srcChunks) {
            await Chunk.create({
              orgId: org._id,
              documentId: newDoc._id,
              pageNumber: sc.pageNumber,
              chunkIndex: sc.chunkIndex,
              text: sc.text,
              embedding: sc.embedding
            });
          }

          console.log(`  ✓ Cloned document: ${newDoc.originalName}`);
        }
      }

      // Add synthetic business documents up to 10
      const syntheticDocs = [
        {
          name: 'Dell_UltraSharp_Monitors_INV-8821.pdf',
          templateId: invoiceTemplate._id,
          status: 'reviewed',
          fields: [
            { key: 'invoice_number', value: 'INV-8821', confidence: 0.95 },
            { key: 'invoice_date', value: '2026-03-12', confidence: 0.92 },
            { key: 'vendor_name', value: 'Dell Technologies India Pvt Ltd', confidence: 0.98 },
            { key: 'vendor_gstin', value: '29AABCD1234E1Z5', confidence: 0.94 },
            { key: 'total_amount', value: 64900.00, confidence: 0.96 },
            { key: 'tax_amount', value: 9900.00, confidence: 0.91 }
          ],
          text: 'TAX INVOICE. Dell Technologies India Pvt Ltd. GSTIN: 29AABCD1234E1Z5. Invoice No: INV-8821. Date: 12-Mar-2026. Bill To: Acme Global Enterprise. Description: 2x Dell UltraSharp 27-inch 4K Monitors U2723QE. HSN: 8471. Subtotal: ₹55,000.00. IGST @ 18%: ₹9,900.00. Grand Total: ₹64,900.00. Payment due in 30 days.'
        },
        {
          name: 'Staples_Office_Supplies_OFF-4091.pdf',
          templateId: invoiceTemplate._id,
          status: 'completed',
          fields: [
            { key: 'invoice_number', value: 'OFF-4091', confidence: 0.91 },
            { key: 'invoice_date', value: '2026-03-15', confidence: 0.88 },
            { key: 'vendor_name', value: 'Staples Stationery Solutions', confidence: 0.94 },
            { key: 'vendor_gstin', value: '33AAACR4567B1Z8', confidence: 0.89 },
            { key: 'total_amount', value: 8450.00, confidence: 0.95 },
            { key: 'tax_amount', value: 1289.00, confidence: 0.87 }
          ],
          text: 'INVOICE: Staples Stationery Solutions. GSTIN: 33AAACR4567B1Z8. Invoice: OFF-4091. Date: 15-Mar-2026. Customer: Acme Global Enterprise. Items: 10x A4 Copier Paper Reams, 24x Ballpoint Pens, 5x Desk Organizers. Total Amount: ₹8,450.00 including ₹1,289.00 GST. Thank you for your business.'
        },
        {
          name: 'AWS_Cloud_Consulting_Invoice_CC-102.pdf',
          templateId: invoiceTemplate._id,
          status: 'reviewed',
          fields: [
            { key: 'invoice_number', value: 'CC-102', confidence: 0.97 },
            { key: 'invoice_date', value: '2026-03-20', confidence: 0.95 },
            { key: 'vendor_name', value: 'CloudScale Consulting Services', confidence: 0.96 },
            { key: 'vendor_gstin', value: '27AABCS7890C1Z2', confidence: 0.93 },
            { key: 'total_amount', value: 45000.00, confidence: 0.99 },
            { key: 'tax_amount', value: 6864.00, confidence: 0.90 }
          ],
          text: 'CONSULTING SERVICES INVOICE. CloudScale Consulting Services. GSTIN: 27AABCS7890C1Z2. Invoice Number: CC-102. Date: 20-Mar-2026. Client: Acme Global Enterprise. Description: Architecture review, Kubernetes setup, and AWS cloud migration consultation (40 hours). Subtotal: ₹38,136.00. Tax (18% GST): ₹6,864.00. Total Payable: ₹45,000.00.'
        },
        {
          name: 'Software_License_Agreement_Acme.pdf',
          templateId: ndaTemplate._id,
          status: 'reviewed',
          fields: [
            { key: 'party_a', value: 'Acme Global Enterprise', confidence: 0.96 },
            { key: 'party_b', value: 'Apex AI Software Solutions Inc.', confidence: 0.94 },
            { key: 'effective_date', value: '2026-01-01', confidence: 0.98 },
            { key: 'term_months', value: 12, confidence: 0.90 },
            { key: 'jurisdiction', value: 'State of Karnataka, India', confidence: 0.92 }
          ],
          text: 'MUTUAL NON-DISCLOSURE AND SOFTWARE LICENSE AGREEMENT. This Agreement is made on 1st January 2026 between Acme Global Enterprise ("Disclosing Party") and Apex AI Software Solutions Inc. ("Receiving Party"). The parties agree to maintain strict confidentiality for a term of 12 months. This agreement is governed by the laws of the State of Karnataka, India.'
        }
      ];

      for (const syn of syntheticDocs) {
        const docCountNow = await Document.countDocuments({ orgId: org._id });
        if (docCountNow >= 10) break;

        const alreadyExists = await Document.findOne({ orgId: org._id, originalName: syn.name });
        if (!alreadyExists) {
          const doc = await Document.create({
            orgId: org._id,
            uploadedBy: userMap.employee._id,
            originalName: syn.name,
            mimeType: 'application/pdf',
            filePath: path.join('uploads', 'doc-synthetic.pdf'),
            size: 45000,
            templateId: syn.templateId,
            status: syn.status,
            pageCount: 1,
            createdAt: new Date(Date.now() - Math.floor(Math.random() * 86400000 * 3))
          });

          await DocumentPage.create({
            orgId: org._id,
            documentId: doc._id,
            pageNumber: 1,
            text: syn.text,
            ocrConfidence: 96
          });

          await Extraction.create({
            orgId: org._id,
            documentId: doc._id,
            templateId: syn.templateId,
            fields: syn.fields.map((f) => ({
              key: f.key,
              value: f.value,
              confidence: f.confidence,
              sourcePage: 1,
              sourceText: syn.text.slice(0, 100)
            })),
            validationIssues: [],
            reviewedBy: userMap.reviewer._id,
            reviewedAt: new Date()
          });

          // Generate vector embedding for chunk search
          try {
            const [embedding] = await embedTexts([syn.text]);
            await Chunk.create({
              orgId: org._id,
              documentId: doc._id,
              pageNumber: 1,
              chunkIndex: 0,
              text: syn.text,
              embedding
            });
          } catch (e) {
            console.log(`  (Note: Ollama embed skipped for synthetic doc ${syn.name}: ${e.message})`);
          }

          console.log(`  ✓ Created synthetic document: ${syn.name}`);
        }
      }
    }

    const finalCount = await Document.countDocuments({ orgId: org._id });
    console.log(`✓ Acme Global Enterprise has ${finalCount} processed documents in library.`);

    // 5. Seed Audit Trail Entries for Demo Activity
    const existingAudits = await AuditLog.countDocuments({ orgId: org._id });
    if (existingAudits < 5) {
      await AuditLog.insertMany([
        {
          orgId: org._id,
          userId: userMap.admin._id,
          userName: userMap.admin.name,
          userRole: userMap.admin.role,
          action: 'login',
          details: { message: 'Admin authenticated from local workstation', ip: '127.0.0.1' },
          createdAt: new Date(Date.now() - 3600000 * 24)
        },
        {
          orgId: org._id,
          userId: userMap.employee._id,
          userName: userMap.employee.name,
          userRole: userMap.employee.role,
          action: 'upload',
          details: { documentCount: finalCount, channel: 'Web UI Dropzone' },
          createdAt: new Date(Date.now() - 3600000 * 18)
        },
        {
          orgId: org._id,
          userId: userMap.reviewer._id,
          userName: userMap.reviewer.name,
          userRole: userMap.reviewer.role,
          action: 'approve',
          details: { verifiedFieldCount: 6, verificationStatus: 'approved' },
          createdAt: new Date(Date.now() - 3600000 * 8)
        },
        {
          orgId: org._id,
          userId: userMap.reviewer._id,
          userName: userMap.reviewer.name,
          userRole: userMap.reviewer.role,
          action: 'export',
          details: { exportFormat: 'xlsx', documentCount: finalCount },
          createdAt: new Date(Date.now() - 3600000 * 4)
        }
      ]);
      console.log('✓ Seeded realistic audit log trail (logins, uploads, approvals, exports)');
    }

    console.log('\n====================================================');
    console.log('       DEMO SEED COMPLETED SUCCESSFULLY!           ');
    console.log('====================================================');
    console.log(`Organization : ${org.name}`);
    console.log(`Documents    : ${finalCount} pre-processed documents ready`);
    console.log(`Password     : ${demoPassword} (for all users)\n`);
    console.log('Role Credentials for Testing:');
    console.log('  1. ADMIN    : admin@acme.com    (Full control: Users, Audits, Approvals, Exports, Delete)');
    console.log('  2. REVIEWER : reviewer@acme.com (Verification: Can edit/approve data, export Excel)');
    console.log('  3. EMPLOYEE : employee@acme.com (Operations: Uploads docs, chats with AI, exports own files)');
    console.log('  4. VIEWER   : viewer@acme.com   (Read-only: Can browse approved docs and chat; cannot edit/export)');
    console.log('====================================================\n');

    process.exit(0);
  } catch (err) {
    console.error('❌ Seeding failed:', err);
    process.exit(1);
  }
}

seed();
