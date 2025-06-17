import { createServer, IncomingMessage } from 'node:http';
import { fileURLToPath, parse } from 'node:url';
import { WebLLMMiddleware } from '../src';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORT = 15408;
const HOST = 'localhost';

const webllm = new WebLLMMiddleware({
  dev: true, // Enable development mode for more verbose logging
  dir: resolve(__dirname, '../'), // Path to the directory containing your model files
  model: 'Llama-3.2-1B-Instruct-q4f32_1-MLC',
});

const handler = webllm.getRequestHandler();

const server = createServer((req, res) => {
  const parsedUrl = parse(req.url ?? '/', true);
  handler(req, res, parsedUrl);
});

server.listen(PORT, HOST, async () => {
  console.log(`Web-LLM OpenAI-Compatible API Server, Server running at: http://${HOST}:${PORT}

OpenAI-Compatible Endpoints:
  GET  /v1/models
  POST /v1/chat/completions
  GET  /health`);
});
