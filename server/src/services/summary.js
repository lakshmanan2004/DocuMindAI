const { Document, DocumentPage, Extraction } = require('../models');

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const LLM_MODEL = process.env.OLLAMA_LLM_MODEL || 'llama3.2';

/**
 * Generate an AI summary of a document in one of three modes: short, detailed, or executive.
 * Supports chunked summarization for long documents (>10,000 characters).
 *
 * @param {Object} params
 * @param {string} params.documentId
 * @param {string} params.orgId
 * @param {'short'|'detailed'|'executive'} [params.format='detailed']
 * @param {boolean} [params.regenerate=false]
 * @returns {Promise<{ format: string, summary: string, lastGeneratedAt: Date, fromCache: boolean }>}
 */
async function generateDocumentSummary({
  documentId,
  orgId,
  format = 'detailed',
  regenerate = false
}) {
  const validFormats = ['short', 'detailed', 'executive'];
  const targetFormat = validFormats.includes(format) ? format : 'detailed';

  // 1. Fetch document with org isolation
  const doc = await Document.findOne({ _id: documentId, orgId });
  if (!doc) {
    throw new Error('Document not found or access denied');
  }

  // 2. Return cached summary if available and not forced to regenerate
  if (!regenerate && doc.summary && doc.summary[targetFormat]) {
    return {
      format: targetFormat,
      summary: doc.summary[targetFormat],
      lastGeneratedAt: doc.summary.lastGeneratedAt || doc.updatedAt,
      fromCache: true
    };
  }

  // 3. Fetch pages and extraction
  const [pages, extraction] = await Promise.all([
    DocumentPage.find({ documentId }).sort({ pageNumber: 1 }).lean(),
    Extraction.findOne({ documentId }).lean()
  ]);

  if (!pages || pages.length === 0) {
    throw new Error('Document has no extracted text pages available to summarize');
  }

  // 4. Format Verified Metadata
  const verifiedMetadataLines = [];
  if (extraction && Array.isArray(extraction.fields)) {
    for (const f of extraction.fields) {
      if (f.value === null || f.value === undefined || f.value === 'N/A') continue;
      let valStr = f.value;
      if (Array.isArray(valStr)) {
        if (valStr.length > 0 && typeof valStr[0] === 'object') {
          valStr = valStr
            .map((item) =>
              Object.entries(item)
                .map(([k, v]) => `${k}: ${v}`)
                .join(', ')
            )
            .join(' | ');
        } else {
          valStr = valStr.join(', ');
        }
      } else if (typeof valStr === 'object') {
        valStr = JSON.stringify(valStr);
      }
      verifiedMetadataLines.push(`• ${f.label || f.key}: ${valStr}`);
    }
  }

  const verifiedBlock =
    verifiedMetadataLines.length > 0
      ? `[VERIFIED EXTRACTED METADATA]:\n${verifiedMetadataLines.join('\n')}\n\n`
      : '';

  // 5. Check document length for chunked summarization
  const fullRawText = pages.map((p) => `--- Page ${p.pageNumber} ---\n${p.text || ''}`).join('\n\n');
  let textToSummarize = fullRawText;

  // If text is large (> 10,000 characters), generate chunked intermediate summaries
  if (fullRawText.length > 10000) {
    const intermediateSummaries = [];
    for (const p of pages) {
      if (!p.text || p.text.trim().length < 40) continue;
      try {
        const chunkPrompt = `Summarize key facts, entities, numbers, and data points from this page concisely:\n\n${p.text.slice(0, 4000)}`;
        const res = await fetch(`${OLLAMA_URL}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: LLM_MODEL,
            messages: [{ role: 'user', content: chunkPrompt }],
            stream: false,
            options: { temperature: 0 }
          })
        });
        if (res.ok) {
          const chunkData = await res.json();
          intermediateSummaries.push(
            `Page ${p.pageNumber} Summary: ${chunkData.message?.content?.trim() || ''}`
          );
        }
      } catch (err) {
        console.warn(`[Summary Service] Failed chunk summary for page ${p.pageNumber}:`, err.message);
      }
    }
    if (intermediateSummaries.length > 0) {
      textToSummarize = intermediateSummaries.join('\n\n');
    }
  }

  // 6. Build Target Format Prompt
  let instruction = '';
  if (targetFormat === 'short') {
    instruction = `Write a crisp, accurate 1-to-2 sentence summary of this document. Include the document type, key entities or parties, relevant dates, and the final total amount or primary result. Do not use conversational filler.`;
  } else if (targetFormat === 'detailed') {
    instruction = `Write a comprehensive, structured summary of this document.
Format:
1. A clear introductory overview paragraph (2-3 sentences explaining what this document is and its main context).
2. Bulleted key details:
   - **Parties / Entities**: Issuers, recipients, students, or organizations.
   - **Key Data & Identifiers**: Document IDs, registration numbers, dates, reference codes.
   - **Financials / Academic / Clinical Results**: Line items, breakdown of amounts/grades/values, and grand totals.
   - **Terms & Notes**: Significant conditions, remarks, or policies mentioned.
Always prioritize the [VERIFIED EXTRACTED METADATA] for exact numbers and figures.`;
  } else if (targetFormat === 'executive') {
    instruction = `Write a high-level Executive Briefing for leadership/decision-makers based on this document.
Format using clean Markdown headers:
### Executive Overview
Briefly define the nature of the document, the counterparty or individual, and its operational context.

### Key Metrics & Bottom-Line Results
Bullet points summarizing total financial commitments, scores/outcomes, or critical measurements.

### Significant Provisions & Findings
Summary of deliverables, line items, diagnoses, or contractual terms.

### Action Items & Deadlines
Specific next steps, payment due dates, validity periods, or follow-ups required.

### Risk & Compliance Assessment
Highlight any discrepancies, missing fields, or notable observations (or state 'No immediate compliance risks identified').
Always prioritize the [VERIFIED EXTRACTED METADATA] for exact values and numbers.`;
  }

  const prompt = `${verifiedBlock}DOCUMENT CONTENT:
${textToSummarize.slice(0, 9000)}

INSTRUCTIONS:
${instruction}

Output only the formatted summary without meta-commentary.`;

  // 7. Call Llama 3.2
  const response = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: LLM_MODEL,
      messages: [
        {
          role: 'system',
          content:
            'You are DocuMind AI Executive Summarizer. You produce highly accurate, grounded, professional document summaries.'
        },
        { role: 'user', content: prompt }
      ],
      stream: false,
      options: { temperature: 0.1 }
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Ollama summary error (${response.status}): ${errText}`);
  }

  const data = await response.json();
  const summaryText = data.message?.content?.trim() || 'Summary could not be generated.';

  // 8. Cache summary on document record
  const now = new Date();
  if (!doc.summary) {
    doc.summary = {};
  }
  doc.summary[targetFormat] = summaryText;
  doc.summary.lastGeneratedAt = now;
  doc.markModified('summary');
  await doc.save();

  return {
    format: targetFormat,
    summary: summaryText,
    lastGeneratedAt: now,
    fromCache: false
  };
}

module.exports = {
  generateDocumentSummary
};
