const mongoose = require('mongoose');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../.env') });

const { Document, DocumentPage } = require('../src/models');
const { extractWithLlama, postProcessExtracted } = require('../src/services/llm');
const { builtInTemplates } = require('../src/seed/templates');

async function testEnhanced() {
  await mongoose.connect(process.env.MONGO_URI);

  const labTmpl = builtInTemplates.find(t => t.name === 'Lab Report');
  const markTmpl = builtInTemplates.find(t => t.name === 'Mark Sheet');

  // Test 1: sterling-accuris
  const sterlingDoc = await Document.findOne({ originalName: /sterling/i });
  if (sterlingDoc) {
    const pages = await DocumentPage.find({ documentId: sterlingDoc._id }).sort({ pageNumber: 1 });
    const fullText = pages.map(p => p.text).join('\n\n');

    console.log('\n==============================================');
    console.log('TESTING LAB REPORT EXTRACTION: sterling-accuris');
    console.log('==============================================');

    const raw = await extractWithLlama(fullText, labTmpl);
    console.log('Post-processed Result:');
    console.log('  patient_name:', raw.patient_name);
    console.log('  patient_id:', raw.patient_id);
    console.log('  report_date:', raw.report_date);
    console.log('  lab_name:', raw.lab_name);
    console.log('  tests count:', raw.tests ? raw.tests.length : 0);
    if (raw.tests && raw.tests.length > 0) {
      console.log('  sample 3 tests:', raw.tests.slice(0, 3));
    }
  }

  // Test 2: cbc-report-format.pdf
  const cbcDoc = await Document.findOne({ originalName: /cbc/i });
  if (cbcDoc) {
    const pages = await DocumentPage.find({ documentId: cbcDoc._id }).sort({ pageNumber: 1 });
    const fullText = pages.map(p => p.text).join('\n\n');

    console.log('\n==============================================');
    console.log('TESTING LAB REPORT EXTRACTION: cbc-report-format');
    console.log('==============================================');

    const raw = await extractWithLlama(fullText, labTmpl);
    console.log('Post-processed Result:');
    console.log('  patient_name:', raw.patient_name);
    console.log('  patient_id:', raw.patient_id);
    console.log('  report_date:', raw.report_date);
    console.log('  lab_name:', raw.lab_name);
    console.log('  tests count:', raw.tests ? raw.tests.length : 0);
    if (raw.tests && raw.tests.length > 0) {
      console.log('  sample 3 tests:', raw.tests.slice(0, 3));
    }
  }

  // Test 3: Screenshot 2026-11-13 131953.png
  const markDoc = await Document.findOne({ originalName: /screenshot/i });
  if (markDoc) {
    const pages = await DocumentPage.find({ documentId: markDoc._id }).sort({ pageNumber: 1 });
    const fullText = pages.map(p => p.text).join('\n\n');

    console.log('\n==============================================');
    console.log('TESTING MARK SHEET EXTRACTION: Screenshot');
    console.log('==============================================');

    const raw = await extractWithLlama(fullText, markTmpl);
    console.log('Post-processed Result:');
    console.log('  student_name:', raw.student_name);
    console.log('  register_number:', raw.register_number);
    console.log('  institution:', raw.institution);
    console.log('  course:', raw.course);
    console.log('  semester:', raw.semester);
    console.log('  exam_session:', raw.exam_session);
    console.log('  subjects count:', raw.subjects ? raw.subjects.length : 0);
    console.log('  subjects:', raw.subjects);
  }

  await mongoose.disconnect();
}

testEnhanced().catch(console.error);
