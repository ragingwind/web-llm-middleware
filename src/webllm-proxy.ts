import type { ChatCompletionCreateParamsBase } from 'openai/resources/chat/completions';

/**
 * WebLLMRequest interface defines the structure of the request
 */
interface WebLLMRequest extends ChatCompletionCreateParamsBase {
  system?: string;
  prompt?: string;
}

/**
 * WebLLMResponse interface defines the structure of the response
 */
export interface WebLLMProxy {
  isReady(): boolean;
  getModel(): string;
  setModel(model: string): Promise<boolean>;
  generateText(request: WebLLMRequest): Promise<string>;
  initialize(options: {
    model: string;
    onProgress?: (progress: number) => void;
  }): Promise<void>;
}

declare global {
  interface Window {
    webllmProxy: WebLLMProxy;
  }
}
