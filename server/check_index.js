const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const mongoose = require('mongoose');

async function checkIndex() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to Atlas');
  const coll = mongoose.connection.collection('chunks');
  
  if (coll.listSearchIndexes) {
    try {
      const cursor = coll.listSearchIndexes();
      const indexes = await cursor.toArray();
      console.log('EXISTING_SEARCH_INDEXES:', JSON.stringify(indexes, null, 2));

      const hasVectorIndex = indexes.some(idx => idx.name === 'chunk_vector_index');
      if (!hasVectorIndex) {
        console.log('chunk_vector_index not found. Attempting automatic creation via driver...');
        const indexDefinition = {
          name: 'chunk_vector_index',
          type: 'vectorSearch',
          definition: {
            fields: [
              {
                type: 'vector',
                path: 'embedding',
                numDimensions: 768,
                similarity: 'cosine'
              },
              {
                type: 'filter',
                path: 'orgId'
              },
              {
                type: 'filter',
                path: 'documentId'
              }
            ]
          }
        };

        if (coll.createSearchIndex) {
          const res = await coll.createSearchIndex(indexDefinition);
          console.log('createSearchIndex result:', res);
        } else {
          console.log('Driver does not support createSearchIndex directly.');
        }
      } else {
        console.log('✓ chunk_vector_index already exists!');
      }
    } catch (err) {
      console.log('Error inspecting search indexes:', err.message);
    }
  }

  process.exit(0);
}

checkIndex().catch(e => {
  console.error('Check failed:', e);
  process.exit(1);
});
