require('dotenv').config();

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const EMBED_MODEL = process.env.EMBED_MODEL || 'nomic-embed-text';

/**
 * Generate vector embeddings for an array of texts using Ollama
 * @param {string[]} texts - Array of string chunks to embed
 * @param {number} [batchSize=16] - Batch size for Ollama requests
 * @returns {Promise<number[][]>} Array of embedding vector arrays
 */
async function embedTexts(texts, batchSize = 16) {
  if (!Array.isArray(texts) || texts.length === 0) {
    return [];
  }

  // Filter out any blank texts
  const cleanedTexts = texts.map((t) => (typeof t === 'string' ? t.trim() : '')).filter(Boolean);
  if (cleanedTexts.length === 0) {
    return [];
  }

  const allEmbeddings = [];

  for (let i = 0; i < cleanedTexts.length; i += batchSize) {
    const batch = cleanedTexts.slice(i, i + batchSize);

    try {
      const response = await fetch(`${OLLAMA_URL}/api/embed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: EMBED_MODEL,
          input: batch
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Ollama embed error (${response.status}): ${errorText}`);
      }

      const data = await response.json();
      if (!data.embeddings || !Array.isArray(data.embeddings)) {
        throw new Error('Invalid response structure from Ollama embed endpoint');
      }

      allEmbeddings.push(...data.embeddings);
    } catch (err) {
      console.error(`[Embedding Service] Error generating embeddings for batch ${i / batchSize + 1}:`, err.message);
      throw err;
    }
  }

  return allEmbeddings;
}

/**
 * Generate vector embedding for a single text query (e.g. user chat question)
 * @param {string} query - Query string
 * @returns {Promise<number[]>} Embedding vector (768 numbers)
 */
async function embedQuery(query) {
  if (!query || typeof query !== 'string') {
    throw new Error('Query string is required for embedding');
  }

  const embeddings = await embedTexts([query]);
  if (embeddings.length === 0) {
    throw new Error('Failed to generate embedding for query');
  }

  return embeddings[0];
}

module.exports = {
  embedTexts,
  embedQuery,
  EMBED_MODEL
};
