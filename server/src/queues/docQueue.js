const net = require('net');
const { Queue } = require('bullmq');
const { processDocument } = require('./processor');

const connection = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: parseInt(process.env.REDIS_PORT, 10) || 6379,
  maxRetriesPerRequest: null
};

let docQueue = null;
let isRedisAvailable = false;

/**
 * Check if Redis TCP port is open before instantiating BullMQ to avoid connection crash loops
 */
const checkRedisReachable = (host, port, timeout = 300) => {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port });
    socket.setTimeout(timeout);
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('error', () => {
      socket.destroy();
      resolve(false);
    });
    socket.once('timeout', () => {
      socket.destroy();
      resolve(false);
    });
  });
};

// Initialize BullMQ safely if Redis is alive
checkRedisReachable(connection.host, connection.port).then((alive) => {
  if (alive) {
    try {
      docQueue = new Queue('documents', { connection });
      isRedisAvailable = true;
      console.log(`[Queue] BullMQ connected to Redis at ${connection.host}:${connection.port}`);
    } catch (err) {
      isRedisAvailable = false;
      console.warn('[Queue Warning] BullMQ failed to initialize:', err.message);
    }
  } else {
    isRedisAvailable = false;
    console.log(`[Queue] Redis is offline (${connection.host}:${connection.port}). Using direct asynchronous background worker.`);
  }
});

/**
 * Add a document to the processing queue
 * @param {string} documentId - MongoDB ID of the document
 */
const addDocumentJob = async (documentId) => {
  if (isRedisAvailable && docQueue) {
    try {
      await docQueue.add('process', { documentId }, { attempts: 2 });
      console.log(`[Queue] Document ${documentId} added to BullMQ Redis queue`);
      return;
    } catch (err) {
      console.warn('[Queue Warning] Failed to push to Redis, falling back to direct background worker:', err.message);
    }
  }

  // Graceful in-process background fallback if Redis is offline
  console.log(`[Queue Fallback] Dispatching document ${documentId} via background tick`);
  setImmediate(async () => {
    try {
      await processDocument(documentId);
    } catch (err) {
      console.error('[Background Worker Error]', err);
    }
  });
};

module.exports = {
  docQueue,
  connection,
  addDocumentJob,
  checkRedisReachable
};
