const path = require('path');
const dotenv = require('dotenv');

// Load environment variables from .env file
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const connectDB = require('./config/db');

const app = express();
const PORT = process.env.PORT || 5000;

// Security and utility middleware
app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health Check Endpoint (Phase 0 check)
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'DocuMind API',
    timestamp: new Date().toISOString(),
    database: 'connected'
  });
});

// API Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/folders', require('./routes/folderRoutes'));
app.use('/api/documents', require('./routes/documentRoutes'));
app.use('/api/templates', require('./routes/templateRoutes'));
app.use('/api/chat', require('./routes/chatRoutes'));
app.use('/api/export', require('./routes/exportRoutes'));
app.use('/api/audit', require('./routes/auditRoutes'));
app.use('/api/dashboard', require('./routes/dashboardRoutes'));
app.use('/api/users', require('./routes/userRoutes'));

// Global 404 handler
app.use((req, res, next) => {
  res.status(404).json({ message: `Route not found: ${req.originalUrl}` });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('[Unhandled Server Error]', err);
  res.status(err.status || 500).json({
    message: err.message || 'Internal Server Error'
  });
});

// Start server after connecting to database
const startServer = async () => {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`[Server] DocuMind backend listening on port ${PORT}`);
  });
};

startServer();

