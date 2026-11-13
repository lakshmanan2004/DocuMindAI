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
 * @returns {Promise<Array<Object>>}
 */
async function searchChunks(queryVector, orgId, documentId = null, limit = 10) {
  const orgObjectId = new mongoose.Types.ObjectId(orgId);
  const filter = { orgId: orgObjectId };

  if (documentId && mongoose.Types.ObjectId.isValid(documentId)) {
    filter.documentId = new mongoose.Types.ObjectId(documentId);
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
 * @returns {Promise<{ answer: string, sources: Array<Object> }>}
 */
async function answerWithRAG({ question, orgId, documentId = null }) {
  if (!question || !question.trim()) {
    throw new Error('Question is required');
  }

  // 1. Generate query embedding
  const queryVector = await embedQuery(question.trim());

  // 2. Retrieve top candidates
  const candidates = await searchChunks(queryVector, orgId, documentId, 10);

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
    const pairs = ext.fields
      ?.filter((f) => f.value !== null && f.value !== undefined)
      .map((f) => `• ${f.key}: ${f.value}`);
    if (pairs && pairs.length > 0) {
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
1. When asked about a specific product or document (e.g. OnePlus Buds), answer ONLY from the document that actually mentions that product. Do NOT mix information with other documents.
2. For Total Amount, GSTIN, Date, and Invoice Number, ALWAYS use the values from [VERIFIED METADATA].
3. In Indian invoices, currency symbol '₹' may appear misread in OCR text as '3' or 'R' (e.g. '31,499.00' is an OCR misread for ₹1,499.00). In such cases, use the verified total (e.g. 1499).
4. Be concise, direct, and cite sources using bracket notation like [1].
5. If the answer cannot be found in the provided context, reply exactly:
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

module.exports = {
  answerWithRAG,
  searchChunks,
  cosineSimilarity,
  scoreKeywordMatch
};
