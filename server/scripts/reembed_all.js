const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const { Document, DocumentPage, Chunk } = require('../src/models');
const { chunkDocumentPages } = require('../src/services/chunk');
const { embedTexts } = require('../src/services/embed');

async function reembedAll() {
  console.log('=== DOCUMIND VECTOR EMBEDDING BACKFILL SCRIPT ===');
  await mongoose.connect(process.env.MONGO_URI);
  console.log('✓ Connected to MongoDB Atlas');

  const documents = await Document.find({ status: { $in: ['completed', 'needs_review', 'reviewed'] } });
  console.log(`Found ${documents.length} existing documents to process for vector search.`);

  for (const doc of documents) {
    console.log(`\nProcessing document: ${doc.originalName} (${doc._id})...`);
    const pages = await DocumentPage.find({ documentId: doc._id }).sort({ pageNumber: 1 });

    if (!pages || pages.length === 0) {
      console.log(`  Skipping: No extracted text pages found for ${doc.originalName}`);
      continue;
    }

    const pageChunks = chunkDocumentPages(pages, 800, 120);
    if (pageChunks.length === 0) {
      console.log(`  Skipping: Document has no text content`);
      continue;
    }

    console.log(`  Generating ${pageChunks.length} embeddings using Ollama nomic-embed-text...`);
    const chunkTexts = pageChunks.map((c) => c.text);
    const embeddings = await embedTexts(chunkTexts);

    // Clear existing chunks for this document
    await Chunk.deleteMany({ documentId: doc._id });

    const chunkDocs = pageChunks.map((c, idx) => ({
      orgId: doc.orgId,
      documentId: doc._id,
      pageNumber: c.pageNumber,
      chunkIndex: c.chunkIndex,
      text: c.text,
      embedding: embeddings[idx]
    }));

    await Chunk.insertMany(chunkDocs);
    console.log(`  ✓ Successfully stored ${chunkDocs.length} vector chunks for ${doc.originalName}`);
  }

  const totalChunks = await Chunk.countDocuments();
  console.log(`\n🎉 Backfill complete! Total chunks in database: ${totalChunks}`);
  process.exit(0);
}

reembedAll().catch((err) => {
  console.error('❌ Backfill failed:', err);
  process.exit(1);
});

