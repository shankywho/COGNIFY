import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import helmet from 'helmet';

import authRoutes from './routes/auth.routes';
import chatRoutes from './routes/chat.routes';
import workspaceRoutes from './routes/workspace.routes';
import fileRoutes from './routes/files.routes';
import analyticRoutes from './routes/analytics.routes';
import apiKeyRoutes from './routes/apikeys.routes';
import teamRoutes from './routes/teams.routes';
import streamRoutes from './routes/stream.routes';
import memoryRoutes from './routes/memory.routes';
import billingRoutes from './routes/billing.routes';
import agentRoutes from './routes/agents.routes';
import promptRoutes from './routes/prompts.routes';
import integrationRoutes from './routes/integrations.routes';
import commentsRoutes from './routes/comments.routes';
import workflowsRoutes from './routes/workflows.routes';

import compression from 'compression';
import { errorHandler } from './middleware/errorHandler.middleware';
import { publicLimiter, workspaceReadLimiter } from './middleware/rateLimiter';
import { requestContextMiddleware } from './middleware/requestContext';
import { env } from './config/env';

const app = express();

// Correlation ID & Context (must be first)
app.use(requestContextMiddleware);

// Security & logging
app.use(helmet());
app.use(compression({ threshold: 1024 })); // Zero-cost Gzip/Deflate compression on responses > 1KB
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || origin === env.CLIENT_URL || /^http:\/\/localhost:\d+$/.test(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));

// NOTE: /api/billing/webhook needs raw body — must come before express.json()
// The billing route applies its own express.raw() on the webhook path.
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Global Tiered Rate Limiting
app.use('/api/auth', publicLimiter);
app.use('/api', workspaceReadLimiter);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/workspaces', workspaceRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/analytics', analyticRoutes);
app.use('/api/apikeys', apiKeyRoutes);
app.use('/api/teams', teamRoutes);
app.use('/api/stream', streamRoutes);
app.use('/api/memory', memoryRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/agents', agentRoutes);
app.use('/api/prompts', promptRoutes);
app.use('/api/integrations', integrationRoutes);
app.use('/api/comments', commentsRoutes);
app.use('/api/workflows', workflowsRoutes);


app.get('/', (req, res) => {
  res.json({ status: 'ok', version: '1.0.0' });
});

import * as Sentry from "@sentry/node";

// Sentry error handler (must be registered before custom error handlers)
Sentry.setupExpressErrorHandler(app);

// Global error handler (must be last)
app.use(errorHandler);

export default app;
