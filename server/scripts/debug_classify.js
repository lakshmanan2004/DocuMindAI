const mongoose = require('mongoose');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../.env') });

const { Document, DocumentPage, Template } = require('../src/models');

async function debugClassify() {
  await mongoose.connect(process.env.MONGO_URI);
  const doc = await Document.findOne({ originalName: /sterling/i });
  const pages = await DocumentPage.find({ documentId: doc._id }).sort({ pageNumber: 1 });
  const fullText = pages.map((p) => p.text).join('\n\n');
  const sample = fullText.slice(0, 4000);

  console.log('Sample snippet from Sterling (first 300 chars):');
  console.log(sample.slice(0, 300));

  const orgTemplates = await Template.find({ orgId: doc.orgId });
  for (const t of orgTemplates) {
    console.log(`Template: "${t.name}" -> ID: ${t._id}`);
  }

  const candidatesList = orgTemplates
    .map(
      (t) =>
        `- ID: ${t._id}\n  Name: ${t.name}\n  Description: ${t.description || ''}\n  Keywords: ${(t.keywords || []).join(', ')}`
    )
    .join('\n\n');

  const prompt = `Classify this document into EXACTLY ONE of the following candidate document types:

${candidatesList}

Classification Guidelines:
- If the document contains medical/diagnostic test results, laboratory investigations, pathology, patient details, blood, hemoglobin, or reference ranges, it is a LAB REPORT.
- If the document contains academic marks, semester, subjects, grades, college/university transcripts, it is a MARK SHEET.
- If the document contains tax invoice, GSTIN, CGST/SGST/IGST breakdown, it is an INVOICE.
- If the document is a commercial purchase order sent to a vendor with a PO number and delivery date, it is a PURCHASE ORDER.
- If the document contains agreement clauses, terms between contracting parties, or NDA, it is a CONTRACT OR AGREEMENT.

Document Sample:
"""
${sample}
"""

Return ONLY a JSON object with:
- "templateId": the exact candidate ID string (or null if none fit)
- "templateName": candidate name (or "Other")
- "confidence": confidence between 0.0 and 1.0 (if below 0.5, use null for templateId)
- "reason": one brief sentence`;

  console.log('\nSending prompt to Ollama (llama3.2)...');
  const res = await fetch('http://localhost:11434/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'llama3.2',
      messages: [
        { role: 'system', content: 'You are an expert document classifier. Return ONLY valid JSON.' },
        { role: 'user', content: prompt }
      ],
      stream: false,
      format: 'json',
      options: { temperature: 0 }
    })
  });

  const data = await res.json();
  console.log('\n--- Ollama Response Content ---');
  console.log(data.message?.content);

  await mongoose.disconnect();
}

debugClassify().catch((e) => {
  console.error(e);
  process.exit(1);
});

