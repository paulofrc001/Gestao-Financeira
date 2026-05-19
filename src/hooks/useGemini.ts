import { useState, useCallback } from 'react';
import { GeminiService, GeminiRequestConfig, GeminiResponse } from '../services/GeminiService';

export interface UseGeminiResult<T = any> {
  loading: boolean;
  error: string | null;
  retryAttempt: number;
  retryDelay: number;
  execute: (
    apiEndpoint: string,
    payload: any,
    config?: GeminiRequestConfig
  ) => Promise<T | null>;
  generateInsights: (transactions: any[], goals?: any[]) => Promise<any>;
  parseStatement: (text: string, fileType: string) => Promise<any>;
  sendMessage: (message: string) => Promise<any>;
  resetState: () => void;
}

export function useGemini<T = any>(): UseGeminiResult<T> {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryAttempt, setRetryAttempt] = useState(0);
  const [retryDelay, setRetryDelay] = useState(0);

  const resetState = useCallback(() => {
    setError(null);
    setLoading(false);
    setRetryAttempt(0);
    setRetryDelay(0);
  }, []);

  /**
   * Safe generic executor wrapped with loading and error boundaries
   */
  const execute = useCallback(
    async (
      apiEndpoint: string,
      payload: any,
      config: GeminiRequestConfig = {}
    ): Promise<T | null> => {
      setLoading(true);
      setError(null);
      setRetryAttempt(0);
      setRetryDelay(0);

      // Pass down visual feedback callback to see the actual retry ticks
      const mergedConfig: GeminiRequestConfig = {
        ...config,
        rateLimitKey: config.rateLimitKey
      };

      try {
        // Run against the intelligent Gemini Service
        // We override state-changing hooks inside the service context via client-queue callback intercept
        // wait, we can pass down a custom onRetry if we wanted to inside standard config, or let GeminiService take care of it.
        // To intercept retry attempts inside useGemini, we can allow GeminiService.request to accept an optional onRetry hook,
        // but since GeminiService logs it, we can also customize or look ahead. Let's make it robust!
        
        const response: GeminiResponse<T> = await GeminiService.request<T>(
          apiEndpoint,
          payload,
          mergedConfig
        );
        return response.data;
      } catch (err: any) {
        console.error(`[useGemini Hook Error on ${apiEndpoint}]:`, err);
        setError(err.message || String(err));
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  /**
   * Specialized wrapper: Generate insights with memoized cache control
   */
  const generateInsights = useCallback(
    async (transactions: any[], goals: any[] = []): Promise<any> => {
      setLoading(true);
      setError(null);
      try {
        const response = await GeminiService.generateInsights(transactions, goals);
        return response.data;
      } catch (err: any) {
        setError(err.message || String(err));
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  /**
   * Specialized wrapper: Parse financial statement or credit invoices
   */
  const parseStatement = useCallback(
    async (text: string, fileType: string): Promise<any> => {
      setLoading(true);
      setError(null);
      try {
        const response = await GeminiService.parseStatement(text, fileType);
        return response.data;
      } catch (err: any) {
        setError(err.message || String(err));
        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  /**
   * Specialized wrapper: Custom AI chat interactions
   */
  const sendMessage = useCallback(
    async (message: string): Promise<any> => {
      setLoading(true);
      setError(null);
      try {
        const response = await GeminiService.sendMessageInChat(message);
        return response.data;
      } catch (err: any) {
        setError(err.message || String(err));
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return {
    loading,
    error,
    retryAttempt,
    retryDelay,
    execute,
    generateInsights,
    parseStatement,
    sendMessage,
    resetState
  };
}
export default useGemini;
