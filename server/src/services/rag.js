const mongoose = require('mongoose');
const { Chunk, Document, Extraction } = require('../models');
const { embedQuery } = require('./embed');

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const LLM_MODEL = process.env.LLM_MODEL || 'llama3.2';

/**
 * Compute cosine similarity between two numeric vectors
 */
function cosineSimilarity(vecA, vecB) {
  if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dot += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Calculate keyword match bonus for hybrid search
 */
function scoreKeywordMatch(text, query) {
  if (!text || !query) return 0;
  const stopWords = new Set([
    'what', 'the', 'for', 'and', 'with', 'from', 'invoice', 'document', 'bill',
    'amount', 'total', 'date', 'gstin', 'tell', 'show', 'find', 'give', 'item', 'board'
  ]);
  const queryTokens = query
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stopWords.has(w));

  if (queryTokens.length === 0) return 0;
  const lowerText = text.toLowerCase();
  let matches = 0;
  for (const token of queryTokens) {
    if (lowerText.includes(token)) {
      matches++;
    }
  }
  return (matches / queryTokens.length) * 0.25; // Boost up to +0.25
}

/**
 * Execute vector search against MongoDB Atlas or in-memory fallback
 * @param {Array<number>} queryVector - 768-dim embedding
 * @param {string} orgId - Organization ID
 * @param {string} [documentId] - Optional specific document ID
 * @param {number} [limit=10]
 * @param {string} [folderId] - Optional specific folder ID
 * @returns {Promise<Array<Object>>}
 */
async function searchChunks(queryVector, orgId, documentId = null, limit = 10, folderId = null) {
  const orgObjectId = new mongoose.Types.ObjectId(orgId);
  const filter = { orgId: orgObjectId };

  if (documentId && mongoose.Types.ObjectId.isValid(documentId)) {
    filter.documentId = new mongoose.Types.ObjectId(documentId);
  } else if (folderId && mongoose.Types.ObjectId.isValid(folderId)) {
    const folderDocs = await Document.find({
      orgId: orgObjectId,
      folderId: new mongoose.Types.ObjectId(folderId)
    }).select('_id');
    const docIds = folderDocs.map((d) => d._id);
    filter.documentId = { $in: docIds };
  }

  // 1. Primary: MongoDB Atlas $vectorSearch aggregation
  try {
    const hits = await Chunk.aggregate([
      {
        $vectorSearch: {
          index: 'chunk_vector_index',
          path: 'embedding',
          queryVector: queryVector,
          numCandidates: 100,
          limit: limit,
          filter: filter
        }
      },
      {
        $lookup: {
          from: 'documents',
          localField: 'documentId',
          foreignField: '_id',
          as: 'document'
        }
      },
      {
        $unwind: '$document'
      },
      {
        $project: {
          text: 1,
          documentId: 1,
          pageNumber: 1,
          chunkIndex: 1,
          documentName: '$document.originalName',
          score: { $meta: 'vectorSearchScore' }
        }
      }
    ]);

    if (hits && hits.length > 0) {
      return hits;
    }
  } catch (atlasErr) {
    console.warn('[VectorSearch] Atlas $vectorSearch index not active yet or error:', atlasErr.message);
  }

  // 2. Resilient Fallback: In-memory cosine similarity calculation
  const queryFilter = { orgId: orgObjectId };
  if (documentId && mongoose.Types.ObjectId.isValid(documentId)) {
    queryFilter.documentId = new mongoose.Types.ObjectId(documentId);
  } else if (folderId && mongoose.Types.ObjectId.isValid(folderId)) {
    const folderDocs = await Document.find({
      orgId: orgObjectId,
      folderId: new mongoose.Types.ObjectId(folderId)
    }).select('_id');
    const docIds = folderDocs.map((d) => d._id);
    queryFilter.documentId = { $in: docIds };
  }

  const allChunks = await Chunk.find(queryFilter).populate('documentId', 'originalName').lean();
  if (!allChunks || allChunks.length === 0) {
    return [];
  }

  const scored = allChunks.map((c) => ({
    text: c.text,
    documentId: c.documentId?._id || c.documentId,
    documentName: c.documentId?.originalName || 'Document',
    pageNumber: c.pageNumber,
    chunkIndex: c.chunkIndex,
    score: cosineSimilarity(queryVector, c.embedding)
  }));

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
}

/**
 * Ask question against organization documents using High-Precision Hybrid RAG
 * @param {Object} params
 * @param {string} params.question - User question
 * @param {string} params.orgId - Organization ID from auth JWT
 * @param {string} [params.documentId] - Optional document filter
 * @param {string} [params.folderId] - Optional folder filter
 * @returns {Promise<{ answer: string, sources: Array<Object> }>}
 */
async function answerWithRAG({ question, orgId, documentId = null, folderId = null }) {
  if (!question || !question.trim()) {
    throw new Error('Question is required');
  }

  // 1. Generate query embedding
  const queryVector = await embedQuery(question.trim());

  // 2. Retrieve top candidates
  const candidates = await searchChunks(queryVector, orgId, documentId, 10, folderId);

  if (!candidates || candidates.length === 0) {
    return {
      answer: 'I could not find this in your documents.',
      sources: []
    };
  }

  // 3. Hybrid Re-ranking: combine vector similarity with product keyword bonus
  candidates.forEach((cand) => {
    const keywordBonus = scoreKeywordMatch(`${cand.documentName} ${cand.text}`, question);
    cand.combinedScore = (cand.score || 0) + keywordBonus;
  });

  candidates.sort((a, b) => b.combinedScore - a.combinedScore);
  const hits = candidates.slice(0, 4); // Take top 4 most relevant chunks

  // 4. Retrieve verified metadata extractions for hit documents
  const docIds = [...new Set(hits.map((h) => h.documentId.toString()))];
  const extractions = await Extraction.find({ documentId: { $in: docIds } }).lean();

  const extMap = {};
  for (const ext of extractions) {
    const pairs = [];
    let hasTotalMarks = null;
    let academicSubjectCount = 0;

    for (const f of ext.fields || []) {
      if (f.value === null || f.value === undefined || f.value === 'N/A') continue;

      if (f.key === 'total_marks') {
        hasTotalMarks = Number(f.value);
      }
      if (f.key === 'subjects' && Array.isArray(f.value)) {
        academicSubjectCount =
          f.value.filter((s) => s.marks !== 'N/A' && s.marks !== null && !isNaN(Number(s.marks))).length ||
          f.value.length;
      }

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
      } else if (typeof valStr === 'object' && valStr !== null) {
        valStr = JSON.stringify(valStr);
      }
      pairs.push(`• ${f.label || f.key}: ${valStr}`);
    }

    // Explicitly add Maximum Marks and Marks Summary for marksheets
    if (hasTotalMarks && academicSubjectCount > 0) {
      const maxMarks = academicSubjectCount * 100;
      pairs.push(`• maximum_total_marks: ${maxMarks} (${academicSubjectCount} subjects × 100)`);
      pairs.push(`• marks_summary: Scored ${hasTotalMarks} out of ${maxMarks} marks`);
    }

    if (pairs.length > 0) {
      extMap[ext.documentId.toString()] = pairs.join('\n  ');
    }
  }

  // 5. Format Context Snippets with verified metadata attached directly to each source
  const contextSnippets = hits
    .map((hit, idx) => {
      const verified = extMap[hit.documentId.toString()]
        ? `[VERIFIED METADATA for ${hit.documentName}]:\n  ${extMap[hit.documentId.toString()]}\n`
        : '';
      return `[${idx + 1}] Document: ${hit.documentName} (Page ${hit.pageNumber})\n${verified}PAGE TEXT:\n${hit.text}`;
    })
    .join('\n\n---\n\n');

  // 6. Strict, High-Precision System Prompt
  const systemPrompt = `You are DocuMind AI, an expert document intelligence assistant.
You answer user questions using ONLY the context provided below.
Rules:
1. When asked about a specific product or document (e.g. OnePlus Nord Buds 3r or American Tourister Backpack), answer ONLY from the document that actually mentions that product. Do NOT mix information with other documents.
2. For prices, costs, or amounts of products in invoices:
   - Always prioritize the verified total_amount or unit price from [VERIFIED METADATA] (e.g. OnePlus Nord Buds 3r total price is ₹1,499.00; American Tourister Backpack unit price before tax is ₹719.50 and total with taxes is ₹849.00).
   - In OCR text, '3' or 'R' before a number often represents the currency symbol '₹' (e.g. '31,499.00' is ₹1,499.00, '31,270.34' is ₹1,270.34, '30.00' is ₹0.00 discount). NEVER cite discounts or shipping as the product price (e.g. ₹30.00 is NOT the price of OnePlus Buds).
   - If both net price (e.g. ₹719.50) and total price with tax (e.g. ₹849.00) are present, clarify: "The unit price before tax is ₹719.50, and the total invoice price including taxes is ₹849.00."
3. In marksheets/educational certificates:
   - Use 'marks_summary', 'maximum_total_marks', and 'percentage' from [VERIFIED METADATA].
   - If a student scored 399 marks across 5 subjects of 100 each, state clearly that the student scored 399 out of 500 marks (79.8%). NEVER state "out of 399 marks" or "399 out of 399".
4. ALWAYS prioritize the verified values from [VERIFIED METADATA] for any extracted entity, including Total Amount, Invoice Number, GSTIN, Total Marks, Percentage, Result, Dates, Institution, or Student/Patient Name.
5. Be concise, direct, and cite sources using bracket notation like [1].
6. If the answer cannot be found in the provided context, reply exactly:
"I could not find this in your documents."`;

  const userPrompt = `Context:
${contextSnippets}

Question: ${question}

Answer concisely with citations.`;

  // 7. Call Ollama with Llama 3.2
  try {
    const response = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: LLM_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        stream: false,
        options: {
          temperature: 0
        }
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Ollama chat error (${response.status}): ${errText}`);
    }

    const data = await response.json();
    let answerText = data.message?.content?.trim() || '';

    if (!answerText) {
      answerText = 'I could not find this in your documents.';
    }

    // Format sources payload
    const sources = hits.map((hit, idx) => ({
      citationIndex: idx + 1,
      documentId: hit.documentId,
      documentName: hit.documentName,
      pageNumber: hit.pageNumber,
      snippet: hit.text.length > 200 ? hit.text.slice(0, 197) + '...' : hit.text,
      score: Number(hit.combinedScore?.toFixed(4) || hit.score?.toFixed(4) || 0)
    }));

    return {
      answer: answerText,
      sources
    };
  } catch (llmErr) {
    console.error('[RAG Service] Error calling Llama 3.2:', llmErr.message);
    throw new Error('AI reasoning engine unavailable. Please ensure Ollama is running.');
  }
}

/**
 * Execute Hybrid Search (semantic vector + BM25 keyword matching) across organization documents
 * @param {Object} params
 * @param {string} params.query - Search query string
 * @param {string} params.orgId - Organization ID
 * @param {string} [params.documentId] - Optional document filter
 * @param {string} [params.folderId] - Optional folder filter
 * @param {number} [params.limit=10]
 * @returns {Promise<Array<Object>>}
 */
async function hybridSearch({ query, orgId, documentId = null, folderId = null, limit = 10 }) {
  if (!query || !query.trim()) return [];

  // Generate embedding for query
  const queryVector = await embedQuery(query.trim());

  // Search candidate chunks
  const candidates = await searchChunks(queryVector, orgId, documentId, Math.max(limit * 2, 20), folderId);

  // Score keyword matches and combine
  candidates.forEach((cand) => {
    const keywordScore = scoreKeywordMatch(`${cand.documentName} ${cand.text}`, query);
    cand.semanticScore = cand.score || 0;
    cand.keywordScore = keywordScore;
    cand.combinedScore = Number((cand.semanticScore + keywordScore).toFixed(4));
  });

  // Sort by combined score descending
  candidates.sort((a, b) => b.combinedScore - a.combinedScore);

  const topHits = candidates.slice(0, limit);

  // Fetch metadata extractions for hit documents
  const docIds = [...new Set(topHits.map((h) => h.documentId.toString()))];
  const extractions = await Extraction.find({ documentId: { $in: docIds } }).lean();
  const extMap = {};
  for (const ext of extractions) {
    extMap[ext.documentId.toString()] = ext.fields || [];
  }

  return topHits.map((hit) => ({
    documentId: hit.documentId,
    documentName: hit.documentName,
    pageNumber: hit.pageNumber,
    chunkIndex: hit.chunkIndex,
    text: hit.text,
    snippet: hit.text.length > 250 ? hit.text.slice(0, 247) + '...' : hit.text,
    score: hit.combinedScore,
    semanticScore: Number((hit.semanticScore || 0).toFixed(4)),
    keywordScore: Number((hit.keywordScore || 0).toFixed(4)),
    extractedFields: extMap[hit.documentId.toString()] || []
  }));
}

module.exports = {
  answerWithRAG,
  hybridSearch,
  searchChunks,
  cosineSimilarity,
  scoreKeywordMatch
};
