const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

const { Worker } = require('bullmq');
const connectDB = require('../config/db');
const { connection, checkRedisReachable } = require('./docQueue');
const { processDocument } = require('./processor');

const startWorker = async () => {
  const isRedisLive = await checkRedisReachable(connection.host, connection.port);
  if (!isRedisLive) {
    console.log(`[Worker Service] Redis is not reachable at ${connection.host}:${connection.port}.`);
    console.log('[Worker Service] Note: Documents will be processed in the background directly by the main server.');
    return;
  }

  await connectDB();
  console.log('[Worker Service] Connected to database and initializing BullMQ worker...');

  const worker = new Worker(
    'documents',
    async (job) => {
      const { documentId } = job.data;
      console.log(`[Worker Job Received] Processing document ID: ${documentId}`);
      await processDocument(documentId);
    },
    {
      connection,
      concurrency: 1
    }
  );

  worker.on('completed', (job) => {
    console.log(`[Worker Job Completed] Document ${job.data.documentId}`);
  });

  worker.on('failed', (job, err) => {
    console.error(`[Worker Job Failed] Document ${job?.data?.documentId}:`, err.message);
  });

  console.log('[Worker Service] BullMQ document worker running with concurrency 1');
};

startWorker().catch((err) => {
  console.error('[Worker Fatal Error]', err);
  process.exit(1);
});
