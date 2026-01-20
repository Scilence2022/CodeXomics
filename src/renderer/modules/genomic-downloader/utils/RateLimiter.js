/**
 * RateLimiter - Token bucket algorithm for API rate limiting
 * Ensures we don't exceed API rate limits (e.g., NCBI's 3 requests/second)
 */
class RateLimiter {
    constructor(maxRequestsPerSecond = 3) {
        this.maxTokens = maxRequestsPerSecond;
        this.tokens = maxRequestsPerSecond;
        this.refillRate = maxRequestsPerSecond; // tokens per second
        this.lastRefillTime = Date.now();
        this.queue = [];
    }

    /**
     * Acquire a token to make a request
     * If no tokens available, waits until one becomes available
     */
    async acquire() {
        this.refill();

        if (this.tokens >= 1) {
            this.tokens -= 1;
            return Promise.resolve();
        }

        // No tokens available, queue the request
        return new Promise(resolve => {
            this.queue.push(resolve);
            this.processQueue();
        });
    }

    /**
     * Refill tokens based on time elapsed
     */
    refill() {
        const now = Date.now();
        const timePassed = (now - this.lastRefillTime) / 1000; // seconds
        const tokensToAdd = timePassed * this.refillRate;

        this.tokens = Math.min(this.maxTokens, this.tokens + tokensToAdd);
        this.lastRefillTime = now;
    }

    /**
     * Process queued requests when tokens become available
     */
    processQueue() {
        if (this.queue.length === 0) return;

        const interval = setInterval(() => {
            this.refill();

            while (this.tokens >= 1 && this.queue.length > 0) {
                this.tokens -= 1;
                const resolve = this.queue.shift();
                resolve();
            }

            if (this.queue.length === 0) {
                clearInterval(interval);
            }
        }, 1000 / this.refillRate); // Check at refill rate
    }

    /**
     * Reset the rate limiter
     */
    reset() {
        this.tokens = this.maxTokens;
        this.lastRefillTime = Date.now();
        this.queue = [];
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = RateLimiter;
} else {
    window.RateLimiter = RateLimiter;
}
