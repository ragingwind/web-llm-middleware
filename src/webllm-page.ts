import { Browser, chromium, Page } from 'playwright';

/**
 * WebLLMPage is a wrapper around Playwright's Browser and Page classes
 * to interact with a Web-LLM proxy page.
 *
 * It initializes the browser, loads the specified HTML file, and provides
 * methods to evaluate functions in the context of the loaded page.
 */
export class WebLLMPage {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private isInitialized = false;

  constructor(
    private options: { proxyPagePath: string; model: string; dev: boolean }
  ) {}

  log(...args: any[]) {
    if (this.options.dev) {
      console.log('[webllm-page]', ...args);
    }
  }

  async isReady(): Promise<boolean> {
    if (!this.isInitialized || this.page === null) {
      return false;
    }

    return await this.waitFor(() => window.webllmProxy.isReady());
  }

  async evaluate(
    pageFunction: (...args: any[]) => any,
    pageArgs: any
  ): Promise<any> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (!this.page) {
      throw new Error('Browser page not initialized');
    }

    this.log('Check if Web-LLM is ready...');
    const isReady = await this.waitFor(() => window.webllmProxy.isReady());

    this.log('Check if Web-LLM is', isReady ? 'ready' : 'not ready');

    if (!isReady) {
      throw new Error('Web-LLM is not ready');
    }

    return await this.page.evaluate(pageFunction, pageArgs);
  }

  async waitFor<T>(
    func: (this: Window) => T | Promise<T>,
    options?: any
  ): Promise<any> {
    return await this.page?.waitForFunction(func, {
      timeout: 60000,
      ...options,
    });
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      this.log('Initializing Playwright browser...');

      this.browser = await chromium.launch({
        headless: true,
        args: [
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor',
        ],
      });

      this.page = await this.browser.newPage();

      this.page.on('console', (msg) => {
        this.log(msg.text());
      });

      // Load HTML file
      this.log('Loading HTML file...');
      await this.page.goto(`file://${this.options.proxyPagePath}`);

      this.log('Waiting for Web-LLM proxy to be defined...');
      await this.waitFor(() => window.webllmProxy !== undefined);

      this.log('Initializing Web-LLM engine with model:', this.options.model);
      await this.page.evaluate(
        async (model) =>
          await window.webllmProxy.initialize({
            model: model,
          }),
        this.options.model
      );

      this.isInitialized = true;
      this.log('Web-LLM Playwright stub is ready');
    } catch (error) {
      this.log(`Failed to initialize: ${(error as Error).message}`);
      throw error;
    }
  }

  async cleanup(): Promise<void> {
    this.log('Cleaning up...');

    try {
      if (this.browser) {
        await this.browser.close();
        this.browser = null;
        this.page = null;
        this.isInitialized = false;
      }
    } catch (error) {
      this.log('Cleanup failed:', error);
    }

    this.log('Cleanup complete');
  }
}
