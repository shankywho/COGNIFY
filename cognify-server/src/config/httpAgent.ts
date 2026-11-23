import http from "http";
import https from "https";
import axios, { AxiosInstance } from "axios";

/**
 * Shared HTTP / HTTPS Keep-Alive Agents.
 * Reuses existing TCP + TLS connections across external LLM and webhook calls,
 * shaving 60-120ms of handshake latency per call and preventing TIME_WAIT socket exhaustion.
 */
export const keepAliveHttpAgent = new http.Agent({
  keepAlive: true,
  maxSockets: 100,        // Max concurrent sockets per host
  maxFreeSockets: 20,     // Max warm idle sockets to keep open
  timeout: 30000,         // Socket timeout in ms
  keepAliveMsecs: 1000,   // Heartbeat interval
});

export const keepAliveHttpsAgent = new https.Agent({
  keepAlive: true,
  maxSockets: 100,
  maxFreeSockets: 20,
  timeout: 30000,
  keepAliveMsecs: 1000,
});

/**
 * High-performance pre-configured Axios instance with Keep-Alive connection pooling.
 */
export const httpClient: AxiosInstance = axios.create({
  httpAgent: keepAliveHttpAgent,
  httpsAgent: keepAliveHttpsAgent,
  timeout: 15000, // 15-second default timeout
});
