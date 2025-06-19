# web-llm-middleware

![WebLLM Middleware Demo](https://github.com/user-attachments/assets/4d5a6160-9985-4e63-b812-fe595e84c0af)

## 🚀 Usage

### Basic Middleware Integration

The WebLLM middleware provides an OpenAI-compatible API for running large language models locally in the browser.

#### Node.js HTTP Server

```typescript
import { createServer } from 'node:http';
import { parse } from 'node:url';
import { WebLLMMiddleware } from 'web-llm-middleware';

const webllm = new WebLLMMiddleware({
  dev: true, // Enable development logging
  dir: './public', // Directory containing index.html
  model: 'Llama-3.2-1B-Instruct-q4f32_1-MLC',
});

const handler = webllm.getRequestHandler();

const server = createServer((req, res) => {
  const parsedUrl = parse(req.url ?? '/', true);
  handler(req, res, parsedUrl);
});

server.listen(15408, () => {
  console.log('WebLLM server running on http://localhost:15408');
});
```

#### Express.js Integration

```typescript
import express from 'express';
import { WebLLMMiddleware } from 'web-llm-middleware';

const app = express();
const webllm = new WebLLMMiddleware({
  dev: process.env.NODE_ENV === 'development',
  dir: './public',
  model: 'Llama-3.2-1B-Instruct-q4f32_1-MLC',
});

const handler = webllm.getRequestHandler();

// Use WebLLM middleware for all requests
app.use((req, res, next) => {
  handler(req, res);
});

app.listen(15408, () => {
  console.log('Express + WebLLM server running on http://localhost:15408');
});
```

#### Next.js API Route

```typescript
// pages/api/chat.ts or app/api/chat/route.ts
import { WebLLMMiddleware } from 'web-llm-middleware';

const webllm = new WebLLMMiddleware({
  dev: process.env.NODE_ENV === 'development',
  dir: './public',
  model: 'Llama-3.2-1B-Instruct-q4f32_1-MLC',
});

const handler = webllm.getRequestHandler();

export default function chatHandler(req: any, res: any) {
  return handler(req, res);
}
```

### Configuration Options

```typescript
interface WebLLMMiddlewareOptions {
  dir: string; // Directory containing index.html with WebLLM
  model: string; // Model ID to initialize
  dev?: boolean; // Enable development logging (default: false)
}
```

### Available Models

The middleware supports 36+ models including:

- **Llama Series**: 3, 3.1, 3.2 (1B, 3B, 8B, 70B)
- **Qwen Series**: 1.5, 2, 2.5, 3 with Math/Coder variants
- **Phi Series**: 3, 3.5 mini and vision models
- **SmolLM**: Lightweight 135M, 360M, 1.7B models
- **Gemma, Hermes, Mistral**: Various sizes and specializations

See `/v1/models` endpoint for the complete list.

## 🛠️ Development

This project uses:

- **TypeScript** for type safety
- **ES Modules** for modern JavaScript
- **tsx** for running TypeScript files directly
- **Strict mode** enabled in TypeScript for better type checking

### Building

To build the project:

```bash
pnpm run build
```

This will compile TypeScript files from `src/` to JavaScript in `dist/`.

### Development Mode

For development with automatic reloading:

```bash
pnpm run dev
```

## 🧪 Testing

### Quick Start Testing

1. **Start the test server:**

   ```bash
   pnpm test:server
   ```

2. **Test chat completions endpoint:**
   ```bash
   curl -X POST http://localhost:15408/v1/chat/completions \
     -H "Content-Type: application/json" \
     -d @./example/hello.json | jq .choices
   ```

### API Endpoints Testing

#### 1. Health Check

```bash
curl -X GET http://localhost:15408/health | jq
```

Expected response:

```json
{
  "status": "healthy",
  "webllm_initialized": true,
  "timestamp": "2024-06-19T..."
}
```

#### 2. List Available Models

```bash
curl -X GET http://localhost:15408/v1/models | jq .data
```

Returns array of 36 supported models including Llama, Phi, Qwen, and other series.

#### 3. Chat Completions

**Using example file:**

```bash
curl -X POST http://localhost:15408/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d @./example/hello.json
```

**Custom request:**

```bash
curl -X POST http://localhost:15408/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {"role": "user", "content": "What is the capital of France?"}
    ],
    "model": "Llama-3.2-1B-Instruct-q4f32_1-MLC",
    "max_tokens": 50,
    "temperature": 0.7
  }'
```

### Offline Functionality Verification

1. **Disconnect from internet** or block external requests
2. **Start server:** `pnpm test:server`
3. **Verify WebLLM loads:** Check that `lib/web-llm.js` (5.6MB) is served locally
4. **Test completion:** Use any of the above curl commands
5. **Check logs:** Server should show WebLLM initialization without external requests

### Testing Different Models

Test various model families:

```bash
# Small model (fast)
curl -X POST http://localhost:15408/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"messages": [{"role": "user", "content": "Hi"}], "model": "SmolLM-135M-Instruct-q4f16_1-MLC"}'

# Math specialist
curl -X POST http://localhost:15408/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"messages": [{"role": "user", "content": "What is 15 * 23?"}], "model": "Qwen2-Math-7B-Instruct-q4f16_1-MLC"}'

# Code specialist
curl -X POST http://localhost:15408/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"messages": [{"role": "user", "content": "Write a hello world in Python"}], "model": "Qwen2.5-Coder-7B-Instruct-q4f16_1-MLC"}'
```

### Performance Testing

Monitor initialization and response times:

```bash
time curl -X POST http://localhost:15408/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d @./example/hello.json
```

### Terminate Server Process

```bash
lsof -ti:15408 | xargs kill -9
```

## 📝 License

MIT
