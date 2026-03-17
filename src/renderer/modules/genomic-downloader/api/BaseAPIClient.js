/**
 * BaseAPIClient - Base class for all API clients
 * Provides: rate limiting, caching, retry logic, error handling
 */
class BaseAPIClient {
  constructor(config) {
    this.baseUrl = config.baseUrl;
    this.name = config.name || 'API';

    // Rate limiting (default: 3 requests/second for NCBI)
    const RateLimiter = window.RateLimiter || require('../utils/RateLimiter.js');
    this.rateLimit = new RateLimiter(config.maxRequestsPerSecond || 3);

    // Caching (default: 1000 entries)
    const LRUCache = window.LRUCache || require('../utils/LRUCache.js');
    this.cache = new LRUCache(config.cacheSize || 1000);

    // Error handling
    this.ErrorHandler = window.ErrorHandler || require('../utils/ErrorHandler.js');

    // Retry configuration
    this.retryConfig = {
      maxRetries: config.maxRetries || 3,
      backoffType: config.backoffType || 'exponential', // 'exponential' or 'linear'
      initialDelay: config.initialDelay || 1000, // ms
      maxDelay: config.maxDelay || 30000, // ms
    };

    // Request timeout
    this.timeout = config.timeout || 30000; // 30 seconds

    // API key (optional)
    this.apiKey = config.apiKey || null;
  }

  /**
   * Fetch with rate limiting, caching, retry logic, and error handling
   * @param {string} url - Full URL to fetch
   * @param {Object} options - Fetch options
   * @returns {Promise<Object>} Response data
   */
  async fetch(url, options = {}) {
    // Check cache first (unless skipCache is true)
    if (!options.skipCache) {
      const cacheKey = this.getCacheKey(url, options);
      const cached = this.cache.get(cacheKey);
      if (cached) {
        console.log(`[${this.name}] Cache hit: ${url}`);
        return cached;
      }
    }

    // Rate limiting - wait for token
    await this.rateLimit.acquire();

    // Retry logic with exponential backoff
    return await this.retryWithBackoff(async () => {
      const response = await this.fetchWithTimeout(url, options);

      if (!response.ok) {
        const error = new Error(`HTTP ${response.status}: ${response.statusText}`);
        error.status = response.status;
        error.response = response;
        throw error;
      }

      const data = await response.json();

      // Cache successful response
      if (!options.skipCache) {
        const cacheKey = this.getCacheKey(url, options);
        this.cache.set(cacheKey, data);
      }

      return data;
    }, url);
  }

  /**
   * Fetch with timeout
   */
  async fetchWithTimeout(url, options) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      // Add API key to URL if configured
      const finalUrl = this.addAPIKey(url);

      const response = await fetch(finalUrl, {
        ...options,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error.name === 'AbortError') {
        const timeoutError = new Error(`Request timeout after ${this.timeout}ms`);
        timeoutError.name = 'TimeoutError';
        throw timeoutError;
      }

      throw error;
    }
  }

  /**
   * Retry logic with exponential backoff
   */
  async retryWithBackoff(fn, context) {
    let lastError;

    for (let attempt = 0; attempt <= this.retryConfig.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;

        // Don't retry if error is not retryable
        if (!this.ErrorHandler.isRetryable(error)) {
          console.log(`[${this.name}] Error not retryable, failing immediately:`, error.message);
          throw error;
        }

        // Don't retry on last attempt
        if (attempt === this.retryConfig.maxRetries) {
          console.log(`[${this.name}] Max retries (${this.retryConfig.maxRetries}) reached`);
          break;
        }

        // Calculate delay
        const delay = this.calculateBackoff(attempt);
        console.log(
          `[${this.name}] Retry attempt ${attempt + 1}/${this.retryConfig.maxRetries} after ${delay}ms for: ${context}`
        );

        // Wait before retrying
        await this.sleep(delay);
      }
    }

    // All retries failed
    throw lastError;
  }

  /**
   * Calculate backoff delay
   */
  calculateBackoff(attempt) {
    if (this.retryConfig.backoffType === 'exponential') {
      // Exponential: 1s, 2s, 4s, 8s, ...
      const delay = this.retryConfig.initialDelay * Math.pow(2, attempt);
      return Math.min(delay, this.retryConfig.maxDelay);
    } else {
      // Linear: 1s, 2s, 3s, 4s, ...
      const delay = this.retryConfig.initialDelay * (attempt + 1);
      return Math.min(delay, this.retryConfig.maxDelay);
    }
  }

  /**
   * Sleep utility
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Generate cache key from URL and options
   */
  getCacheKey(url, options) {
    const optionsKey = JSON.stringify(options.body || {});
    return `${url}|${optionsKey}`;
  }

  /**
   * Add API key to URL if configured
   */
  addAPIKey(url) {
    if (!this.apiKey) return url;

    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}api_key=${this.apiKey}`;
  }

  /**
   * Build query string from parameters
   */
  buildQueryString(params) {
    return Object.entries(params)
      .filter(([_, value]) => value !== null && value !== undefined && value !== '')
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
      .join('&');
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * Set API key
   */
  setAPIKey(apiKey) {
    this.apiKey = apiKey;
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = BaseAPIClient;
} else {
  window.BaseAPIClient = BaseAPIClient;
}
