import { IncomingMessage } from 'http';
import { ServerResponse } from 'node:http';
import { join } from 'node:path';
import { UrlWithParsedQuery } from 'node:url';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { WebLLMPage } from './web-llm-page.js';

const __dirname = new URL('.', import.meta.url).pathname;

interface WebLLMMiddlewareOptions {
  model: string;
  dev?: boolean;
}

export class WebLLMMiddleware {
  private webllmPage: WebLLMPage | null = null;

  constructor(private options: WebLLMMiddlewareOptions) {}

  #log(...args: any[]) {
    if (this.options.dev) {
      console.log('[web-llm-middleware]', ...args);
    }
  }

  #reqLogMsg(req: IncomingMessage, statusCode: number) {
    const timestamp = new Date().toISOString();
    return `${req.method} ${req.url} - ${statusCode} (${timestamp})`;
  }

  async #initialize() {
    console.log(
      'Initializing WebLLMPage...',
      join(__dirname, 'web-llm-proxy.html')
    );
    this.webllmPage = new WebLLMPage({
      proxyPagePath: join(__dirname, 'web-llm-proxy.html'),
      model: this.options.model,
      dev: this.options.dev ?? false,
    });

    await this.webllmPage.initialize();
  }

  async #responseWithJSON(res: ServerResponse, statusCode: number, data: any) {
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
  }

  async #handleChatCompletions(res: ServerResponse, req: IncomingMessage) {
    try {
      const body = (await parseJSONBody(req)) as any;
      const { messages, prompt, system, max_tokens, temperature, stream } =
        body;

      if (!messages || !Array.isArray(messages)) {
        this.#log(this.#reqLogMsg(req, 400));

        this.#responseWithJSON(res, 400, {
          error: {
            message: 'Messages array is required',
            type: 'invalid_request_error',
          },
        });
        return;
      }

      const reqMessages: ChatCompletionMessageParam[] = messages || [];

      if (reqMessages.length === 0) {
        reqMessages.push({
          role: 'user',
          content: prompt || '',
        });
      }

      if (system) {
        messages.unshift({
          role: 'system',
          content: system,
        });
      }

      this.#log('Request messages:', reqMessages);

      const result = await this.webllmPage?.evaluate(
        async (request: any) => {
          return await window.webllmProxy.generateText({
            ...request,
            messages: request.messages,
          });
        },
        {
          messages: reqMessages,
          max_tokens,
          temperature,
          stream,
        }
      );

      this.#log(this.#reqLogMsg(req, 200), result);

      this.#responseWithJSON(res, 200, result);

      return result;
    } catch (error) {
      this.#log(this.#reqLogMsg(req, 500), 'Error processing request:', error);

      this.#responseWithJSON(res, 500, {
        error: {
          message: (error as Error).message,
          type: 'internal_server_error',
        },
      });
    }
  }

  getRequestHandler() {
    return async (
      req: IncomingMessage,
      res: ServerResponse,
      _parsedUrl?: UrlWithParsedQuery | undefined
    ) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader(
        'Access-Control-Allow-Headers',
        'Content-Type, Authorization'
      );

      const { method, url } = req;

      if (method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
      }

      try {
        // Handle chat completions request
        if (url === '/v1/chat/completions' && method === 'POST') {
          if (this.webllmPage === null) {
            await this.#initialize();
          }

          const result = await this.#handleChatCompletions(res, req);

          this.#log(this.#reqLogMsg(req, 200), result);
          return;
        }

        // Handle model list request
        if (url === '/v1/models' && method === 'GET') {
          this.#responseWithJSON(res, 200, models());

          this.#log(this.#reqLogMsg(req, 200));
          return;
        }

        // Route: Health check
        if (url === '/health' && method === 'GET') {
          const isReady = (await this.webllmPage?.isReady()) || false;
          this.#responseWithJSON(res, 200, {
            status: 'healthy',
            webllm_initialized: isReady,
            timestamp: new Date().toISOString(),
          });

          this.#log(
            this.#reqLogMsg(req, 200),
            'Health check successful',
            isReady
          );
          return;
        }

        // Route: Root endpoint with API documentation
        if (url === '/' && method === 'GET') {
          this.#responseWithJSON(res, 200, {});

          this.#log(this.#reqLogMsg(req, 200));
          return;
        }

        // 404 - Not Found
        this.#responseWithJSON(res, 404, {
          error: {
            message: `The requested URL ${url} was not found on this server.`,
            type: 'not_found_error',
          },
        });

        this.#log(this.#reqLogMsg(req, 404), 'Route not found');
      } catch (error) {
        // 500 - Internal Server Error
        this.#responseWithJSON(res, 500, {
          error: {
            message: 'An unexpected error occurred',
            type: 'internal_server_error',
          },
        });

        this.#log(this.#reqLogMsg(req, 500), 'Internal server error:', error);
      }
    };
  }
}

// Utility function to parse JSON body
async function parseJSONBody(req: IncomingMessage) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });
}

const models = () => [
  // Llama Series
  {
    id: 'Llama-3-8B-Instruct-q4f32_1-MLC',
    object: 'model',
    created: Math.floor(Date.now() / 1000),
    owned_by: 'web-llm',
  },
  {
    id: 'Llama-3.1-70B-Instruct-q4f16_1-MLC',
    object: 'model',
    created: Math.floor(Date.now() / 1000),
    owned_by: 'web-llm',
  },
  {
    id: 'Llama-3.1-8B-q4f32_1-MLC',
    object: 'model',
    created: Math.floor(Date.now() / 1000),
    owned_by: 'web-llm',
  },
  {
    id: 'Llama-3.1-8B-Instruct-q4f32_1-MLC',
    object: 'model',
    created: Math.floor(Date.now() / 1000),
    owned_by: 'web-llm',
  },
  {
    id: 'Llama-3.2-1B-Instruct-q4f32_1-MLC',
    object: 'model',
    created: Math.floor(Date.now() / 1000),
    owned_by: 'web-llm',
  },
  {
    id: 'Llama-3.2-3B-Instruct-q4f32_1-MLC',
    object: 'model',
    created: Math.floor(Date.now() / 1000),
    owned_by: 'web-llm',
  },
  // Hermes Series
  {
    id: 'Hermes-2-Pro-Llama-3-8B-q4f16_1-MLC',
    object: 'model',
    created: Math.floor(Date.now() / 1000),
    owned_by: 'web-llm',
  },
  {
    id: 'Hermes-2-Theta-Llama-3-70B-q4f16_1-MLC',
    object: 'model',
    created: Math.floor(Date.now() / 1000),
    owned_by: 'web-llm',
  },
  {
    id: 'Hermes-2-Theta-Llama-3-8B-q4f16_1-MLC',
    object: 'model',
    created: Math.floor(Date.now() / 1000),
    owned_by: 'web-llm',
  },
  {
    id: 'Hermes-3-Llama-3.1-8B-q4f16_1-MLC',
    object: 'model',
    created: Math.floor(Date.now() / 1000),
    owned_by: 'web-llm',
  },
  {
    id: 'Hermes-3-Llama-3.2-3B-q4f16_1-MLC',
    object: 'model',
    created: Math.floor(Date.now() / 1000),
    owned_by: 'web-llm',
  },
  // Phi Series
  {
    id: 'Phi-3-mini-128k-instruct-q4f16_1-MLC',
    object: 'model',
    created: Math.floor(Date.now() / 1000),
    owned_by: 'web-llm',
  },
  {
    id: 'Phi-3.5-mini-instruct-q4f16_1-MLC',
    object: 'model',
    created: Math.floor(Date.now() / 1000),
    owned_by: 'web-llm',
  },
  {
    id: 'Phi-3.5-vision-instruct-q4f16_1-MLC',
    object: 'model',
    created: Math.floor(Date.now() / 1000),
    owned_by: 'web-llm',
  },
  // Qwen Series
  {
    id: 'Qwen1.5-0.5B-Chat-q4f16_1-MLC',
    object: 'model',
    created: Math.floor(Date.now() / 1000),
    owned_by: 'web-llm',
  },
  {
    id: 'Qwen1.5-1.8B-Chat-q4f16_1-MLC',
    object: 'model',
    created: Math.floor(Date.now() / 1000),
    owned_by: 'web-llm',
  },
  {
    id: 'Qwen1.5-4B-Chat-q4f16_1-MLC',
    object: 'model',
    created: Math.floor(Date.now() / 1000),
    owned_by: 'web-llm',
  },
  {
    id: 'Qwen1.5-7B-Chat-q4f16_1-MLC',
    object: 'model',
    created: Math.floor(Date.now() / 1000),
    owned_by: 'web-llm',
  },
  {
    id: 'Qwen2-0.5B-Instruct-q4f16_1-MLC',
    object: 'model',
    created: Math.floor(Date.now() / 1000),
    owned_by: 'web-llm',
  },
  {
    id: 'Qwen2-1.5B-Instruct-q4f16_1-MLC',
    object: 'model',
    created: Math.floor(Date.now() / 1000),
    owned_by: 'web-llm',
  },
  {
    id: 'Qwen2-7B-Instruct-q4f16_1-MLC',
    object: 'model',
    created: Math.floor(Date.now() / 1000),
    owned_by: 'web-llm',
  },
  {
    id: 'Qwen2.5-0.5B-Instruct-q4f16_1-MLC',
    object: 'model',
    created: Math.floor(Date.now() / 1000),
    owned_by: 'web-llm',
  },
  {
    id: 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC',
    object: 'model',
    created: Math.floor(Date.now() / 1000),
    owned_by: 'web-llm',
  },
  {
    id: 'Qwen2.5-3B-Instruct-q4f16_1-MLC',
    object: 'model',
    created: Math.floor(Date.now() / 1000),
    owned_by: 'web-llm',
  },
  {
    id: 'Qwen2.5-7B-Instruct-q4f16_1-MLC',
    object: 'model',
    created: Math.floor(Date.now() / 1000),
    owned_by: 'web-llm',
  },
  {
    id: 'Qwen3-0.5B-Instruct-q4f16_1-MLC',
    object: 'model',
    created: Math.floor(Date.now() / 1000),
    owned_by: 'web-llm',
  },
  {
    id: 'Qwen2-Math-7B-Instruct-q4f16_1-MLC',
    object: 'model',
    created: Math.floor(Date.now() / 1000),
    owned_by: 'web-llm',
  },
  {
    id: 'Qwen2.5-Coder-7B-Instruct-q4f16_1-MLC',
    object: 'model',
    created: Math.floor(Date.now() / 1000),
    owned_by: 'web-llm',
  },
  // Mistral Series
  {
    id: 'Mistral-7B-Instruct-v0.3-q4f16_1-MLC',
    object: 'model',
    created: Math.floor(Date.now() / 1000),
    owned_by: 'web-llm',
  },
  {
    id: 'Mixtral-8x7B-Instruct-q4f16_1-MLC',
    object: 'model',
    created: Math.floor(Date.now() / 1000),
    owned_by: 'web-llm',
  },
  // DeepSeek Series
  {
    id: 'DeepSeek-R1-Distill-Qwen-1.5B-q4f16_1-MLC',
    object: 'model',
    created: Math.floor(Date.now() / 1000),
    owned_by: 'web-llm',
  },
  {
    id: 'DeepSeek-R1-Distill-Qwen-7B-q4f16_1-MLC',
    object: 'model',
    created: Math.floor(Date.now() / 1000),
    owned_by: 'web-llm',
  },
  // QwQ Series
  {
    id: 'QwQ-32B-Preview-q4f16_1-MLC',
    object: 'model',
    created: Math.floor(Date.now() / 1000),
    owned_by: 'web-llm',
  },
  // SmolLM Series
  {
    id: 'SmolLM-135M-Instruct-q4f16_1-MLC',
    object: 'model',
    created: Math.floor(Date.now() / 1000),
    owned_by: 'web-llm',
  },
  {
    id: 'SmolLM-360M-Instruct-q4f16_1-MLC',
    object: 'model',
    created: Math.floor(Date.now() / 1000),
    owned_by: 'web-llm',
  },
  {
    id: 'SmolLM-1.7B-Instruct-q4f16_1-MLC',
    object: 'model',
    created: Math.floor(Date.now() / 1000),
    owned_by: 'web-llm',
  },
  // Gemma Series
  {
    id: 'Gemma-2-2B-it-q4f16_1-MLC',
    object: 'model',
    created: Math.floor(Date.now() / 1000),
    owned_by: 'web-llm',
  },
  {
    id: 'Gemma-2-9B-it-q4f16_1-MLC',
    object: 'model',
    created: Math.floor(Date.now() / 1000),
    owned_by: 'web-llm',
  },
  // InternLM Series
  {
    id: 'InternLM2.5-7B-Chat-q4f16_1-MLC',
    object: 'model',
    created: Math.floor(Date.now() / 1000),
    owned_by: 'web-llm',
  },
];
