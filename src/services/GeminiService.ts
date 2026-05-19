import { geminiCache } from '../lib/cache';
import { clientRateLimiter } from '../lib/rateLimiter';
import { clientRequestQueue } from '../lib/requestQueue';
import { retryWithBackoff } from '../lib/retryHandler';

export interface GeminiRequestConfig {
  timeoutMs?: number;
  useCache?: boolean;
  cacheTtlMs?: number;
  rateLimitKey?: string;
  skipQueue?: boolean;
}

export interface GeminiResponse<T = any> {
  data: T;
  cached: boolean;
  durationMs: number;
}

export class GeminiService {
  // Store currently running requests to deduplicate and reuse active promises for identical payloads
  private static activeQueries = new Map<string, Promise<any>>();

  // General default configurations
  private static defaultTimeoutMs = 45000; // 45 seconds timeout
  private static minDebounceMs = 2000; // 2 seconds between clicks/calls

  // State trackers for debounce / spam resistance
  private static lastCallTimestamps = new Map<string, number>();

  /**
   * Helper to format any network / API errors into detailed user-friendly error messages in Portuguese
   */
  public static handleFriendlyError(error: any): Error {
    const errorMsg = String(error.message || error).toLowerCase();
    
    if (errorMsg.includes('429') || errorMsg.includes('resource_exhausted') || errorMsg.includes('quota') || errorMsg.includes('limit')) {
      return new Error(
        '⚠️ Quota inteligente esgotada temporariamente. O Gemini recebeu muitas requisições recentemente. Aguarde alguns segundos enquanto nossa fila de backup normaliza o fluxo.'
      );
    }
    
    if (errorMsg.includes('timeout') || errorMsg.includes('aborted') || errorMsg.includes('deadline')) {
      return new Error(
        '⏱️ O servidor demorou muito para responder (Timeout). Verifique sua conexão ou simplifique seu arquivo/pergunta e tente novamente.'
      );
    }

    if (errorMsg.includes('network') || errorMsg.includes('fetch') || errorMsg.includes('failed to fetch')) {
      return new Error(
        '🔌 Falha na conexão de rede. Parece que o servidor está offline ou sua conexão falhou. Tente novamente em instantes.'
      );
    }

    if (errorMsg.includes('service unavailable') || errorMsg.includes('503')) {
      return new Error(
        '🛠️ O serviço inteligente da Google está temporariamente indisponível (Erro 503). Tente recarregar a página.'
      );
    }

    return new Error(`❌ Ocorreu um contratempo processando os dados: ${error.message || 'Erro desconhecido'}`);
  }

  /**
   * Safe fetch with AbortController timeout wrap
   */
  private static async fetchWithTimeout(
    url: string,
    options: RequestInit,
    timeoutMs: number
  ): Promise<Response> {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      clearTimeout(id);
      return response;
    } catch (err: any) {
      clearTimeout(id);
      if (err.name === 'AbortError') {
        throw new Error(`Timeout de processamento de API excedido (${timeoutMs / 1000}s)`);
      }
      throw err;
    }
  }

  /**
   * Generic request executor with advanced features (Cache, Queue, Deduplication, Rate limit, Retry, Timeout)
   */
  public static async request<T = any>(
    apiEndpoint: string,
    payload: any,
    config: GeminiRequestConfig = {}
  ): Promise<GeminiResponse<T>> {
    const startTime = Date.now();
    const endpointName = apiEndpoint.split('/').pop() || 'endpoint';
    
    const useCache = config.useCache ?? true;
    const timeoutMs = config.timeoutMs ?? this.defaultTimeoutMs;
    const rateLimitKey = config.rateLimitKey ?? `user:${endpointName}`;

    // 1. DUST PROTECTION (DEBOUNCE/SPAM CONTROL)
    const now = Date.now();
    const lastCall = this.lastCallTimestamps.get(rateLimitKey) || 0;
    if (now - lastCall < this.minDebounceMs) {
      const waitTime = this.minDebounceMs - (now - lastCall);
      console.warn(`[GeminiService] Debounce active for key "${rateLimitKey}". Must wait ${waitTime}ms.`);
      throw new Error(`Aguarde e evite cliques rápidos consecutivos! Espere mais ${(waitTime / 1000).toFixed(1)} segundos.`);
    }
    this.lastCallTimestamps.set(rateLimitKey, now);

    // 2. CLIENT-SIDE RATE LIMITING (SLIDING WINDOW)
    // Rate limit per client type: max 5 calls per endpoint in a rolling 15 seconds window
    const limitCheck = clientRateLimiter.check(rateLimitKey, 5, 15000);
    if (limitCheck.limited) {
      throw new Error(
        `Limite de uso esgotado para esta funcionalidade. Tente novamente em ${(limitCheck.retryAfter / 1000).toFixed(0)} segundos.`
      );
    }

    // 3. CACHE LOOKUP
    const cacheKey = geminiCache.generateKey(endpointName, payload);
    if (useCache) {
      const cachedValue = geminiCache.get<T>(cacheKey);
      if (cachedValue !== null) {
        return {
          data: cachedValue,
          cached: true,
          durationMs: Date.now() - startTime
        };
      }
    }

    // 4. PREVENT DUPLICATION (REUSE PENDING PROMISES)
    // If there is actively a request querying the EXACT SAME payload in-flight, await and return it!
    const activePromise = this.activeQueries.get(cacheKey);
    if (activePromise) {
      console.log(`[GeminiService] Re-using active pending promise to prevent duplicate API fetch for: ${cacheKey}`);
      try {
        const result = await activePromise;
        return {
          data: result,
          cached: false,
          durationMs: Date.now() - startTime
        };
      } catch (err) {
        throw this.handleFriendlyError(err);
      }
    }

    // Define the async fetch callback that will be wrapped by Retry with Backoff
    const executeFetchTask = async (): Promise<T> => {
      console.log(`[GeminiService] [START] Request to "${apiEndpoint}" initiated.`);
      
      const response = await this.fetchWithTimeout(
        apiEndpoint,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        },
        timeoutMs
      );

      if (!response.ok) {
        const serverError = await response.json().catch(() => ({}));
        throw new Error(serverError.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const responseData = await response.json();
      console.log(`[GeminiService] [SUCCESS] Request to "${apiEndpoint}" completed in ${Date.now() - startTime}ms.`);
      return responseData as T;
    };

    // 5. ENVELOPE WITH REQUEST QUEUE & AUTO-RETRY ON 429
    // Store in our activeQueries Map so double-clack requests piggyback on it
    const fetchPromise = (async () => {
      try {
        // Run retry wrapper inside our request queue to control concurrency
        const result = await clientRequestQueue.enqueue(
          () => retryWithBackoff(executeFetchTask, {
            maxAttempts: 4,
            initialDelayMs: 2500,
            backoffFactor: 2,
            onRetry: (attempt, delayMs, err) => {
              console.log(`[GeminiService] RETRYING request. Attempt ${attempt}, delay: ${delayMs.toFixed(0)}ms. Reason:`, err.message);
            }
          }),
          endpointName
        );

        // Populate cache if success
        if (useCache) {
          geminiCache.set(cacheKey, result, config.cacheTtlMs);
        }

        return result;
      } finally {
        // Guarantee clean deletion from active in-flight map
        this.activeQueries.delete(cacheKey);
      }
    })();

    this.activeQueries.set(cacheKey, fetchPromise);

    try {
      const data = await fetchPromise;
      return {
        data,
        cached: false,
        durationMs: Date.now() - startTime
      };
    } catch (error: any) {
      throw this.handleFriendlyError(error);
    }
  }

  /**
   * Pre-packaged method: Generate financial insights from current transactions and goals
   */
  public static async generateInsights(transactions: any[], goals: any[] = []): Promise<any> {
    return this.request(
      '/api/ai/insights',
      { transactions, goals },
      { useCache: true, cacheTtlMs: 2 * 60 * 1000 } // Cache insights for 2 minutes
    );
  }

  /**
   * Pre-packaged method: Submit simple user message to standard AI chat agent
   */
  public static async sendMessageInChat(message: string): Promise<any> {
    return this.request(
      '/api/ai/chat',
      { message },
      { useCache: false } // Never cache live chats
    );
  }

  /**
   * Pre-packaged method: Parse bank or credit statement files text and extract data
   */
  public static async parseStatement(text: string, fileType: string): Promise<any> {
    return this.request(
      '/api/ai/parse-statement',
      { text, fileType },
      { useCache: true, cacheTtlMs: 10 * 60 * 1000, timeoutMs: 60000 } // Statement parses can take longer, cache for 10 min
    );
  }
}
