/**
 * Document text chunking service for RAG vector search
 * Preserves page boundaries to guarantee accurate citations
 */

/**
 * Splits text into overlapping sliding window chunks.
 * @param {string} text - Raw page text
 * @param {number} size - Target chunk size in characters (default 800)
 * @param {number} overlap - Overlap size in characters (default 120)
 * @returns {Array<string>} Array of chunk strings
 */
function chunkText(text, size = 800, overlap = 120) {
  if (!text || typeof text !== 'string') return [];
  const trimmed = text.trim();
  if (trimmed.length === 0) return [];

  if (trimmed.length <= size) {
    return [trimmed];
  }

  const chunks = [];
  const step = Math.max(1, size - overlap);

  for (let i = 0; i < trimmed.length; i += step) {
    const chunk = trimmed.slice(i, i + size).trim();
    if (chunk.length > 0) {
      chunks.push(chunk);
    }
    // If the slice reached the end of the text, stop
    if (i + size >= trimmed.length) {
      break;
    }
  }

  return chunks;
}

/**
 * Splits an array of document pages into chunks with metadata
 * @param {Array<{ pageNumber: number, text: string }>} pages
 * @param {number} [size=800]
 * @param {number} [overlap=120]
 * @returns {Array<{ pageNumber: number, chunkIndex: number, text: string }>}
 */
function chunkDocumentPages(pages, size = 800, overlap = 120) {
  const result = [];
  let globalChunkIndex = 0;

  for (const page of pages) {
    if (!page.text || page.text.trim().length === 0) continue;
    const pageChunks = chunkText(page.text, size, overlap);

    for (const chunkTextContent of pageChunks) {
      result.push({
        pageNumber: page.pageNumber,
        chunkIndex: globalChunkIndex++,
        text: chunkTextContent
      });
    }
  }

  return result;
}

module.exports = {
  chunkText,
  chunkDocumentPages
};
