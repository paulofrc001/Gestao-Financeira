export interface RetryOptions {
  maxAttempts?: number;
  initialDelayMs?: number;
  backoffFactor?: number;
  onRetry?: (attempt: number, delayMs: number, error: any) => void;
}

/**
 * Checks if an error is rate-limit or resource exhaustion related (HTTP 429)
 */
export function isRateLimitError(error: any): boolean {
  if (!error) return false;
  
  const msg = String(error.message || error.statusText || '').toLowerCase();
  const status = Number(error.status || error.statusCode || error.response?.status || 0);

  return (
    status === 429 ||
    msg.includes('429') ||
    msg.includes('resource_exhausted') ||
    msg.includes('quota exceeded') ||
    msg.includes('too many requests') ||
    msg.includes('rate limit') ||
    msg.includes('exhausted')
  );
}

/**
 * Parses potential API errors or headers to find recommended wait times (e.g. from Retry-After headers)
 */
export function getRecommendedRetryDelay(error: any): number | null {
  if (!error) return null;
  
  // Try reading standard headers or specific error properties if available
  const headers = error.headers || error.response?.headers;
  if (headers) {
    const retryAfter = headers.get?.('retry-after') || headers['retry-after'];
    if (retryAfter) {
      const delaySeconds = parseInt(retryAfter, 10);
      if (!isNaN(delaySeconds)) {
        return delaySeconds * 1000;
      }
    }
  }

  // Look for rate-limit quota details inside potential nested Google AI SDK errors
  try {
    const details = error.details || error.response?.data?.error?.details;
    if (details && Array.isArray(details)) {
      for (const d of details) {
        if (d.metadata && d.metadata.retryAfter) {
          const parsed = parseInt(d.metadata.retryAfter, 10);
          if (!isNaN(parsed)) return parsed * 1000; // if it is stored in seconds
        }
      }
    }
  } catch {
    // Ignore issues checking deeply nested properties
  }

  return null;
}

/**
 * Wraps any promise-returning function with exponential backoff on retry-able errors
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    initialDelayMs = 2000,
    backoffFactor = 2,
    onRetry
  } = options;

  let attempt = 0;

  while (true) {
    attempt++;
    try {
      return await fn();
    } catch (error: any) {
      // If we reached the maximum attempts count, or it is not a rate limit error, propagate error
      const isRetriable = isRateLimitError(error);
      
      if (!isRetriable || attempt >= maxAttempts) {
        console.error(`[RetryHandler] Failed permanently on attempt ${attempt}/${maxAttempts}. Error:`, error);
        throw error;
      }

      // Calculate delay: prefer recommended API wait times, fallback to exponential backoff
      const apiRecommendedDelay = getRecommendedRetryDelay(error);
      const backoffDelay = initialDelayMs * Math.pow(backoffFactor, attempt - 1);
      const chosenDelay = apiRecommendedDelay !== null 
        ? Math.max(apiRecommendedDelay, 1000) // Don't do sub-second delays if API specifies weird stuff
        : backoffDelay;

      // Ensure some randomized jitter to avoid concurrent systems executing exactly at same time
      const jitter = Math.random() * 500; 
      const finalDelay = chosenDelay + jitter;

      console.warn(`[RetryHandler] Rate limited on attempt ${attempt}/${maxAttempts}. Retrying in ${finalDelay.toFixed(0)}ms. Error msg: "${error.message}"`);

      if (onRetry) {
        onRetry(attempt, finalDelay, error);
      }

      await new Promise(resolve => setTimeout(resolve, finalDelay));
    }
  }
}
