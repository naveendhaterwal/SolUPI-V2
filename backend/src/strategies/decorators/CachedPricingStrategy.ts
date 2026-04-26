import { IPricingStrategy, PricingResult } from '../IPricingStrategy';

/**
 * CachedPricingStrategy — Decorator Pattern
 * ───────────────────────────────────────────
 * OOP Principles: Open/Closed, Composition over Inheritance
 *
 * Problem solved: Every `calculateUSDCAmount()` call hit the external
 * exchange rate API, adding latency and burning API quota. This
 * decorator transparently caches the result for a configurable TTL.
 *
 * Usage:
 *   const pricing = new CachedPricingStrategy(new ExchangeRateApiStrategy(), 60_000);
 */
export class CachedPricingStrategy implements IPricingStrategy {
    private cache: PricingResult | null = null;
    private cacheTime: number = 0;

    constructor(
        private readonly inner: IPricingStrategy,
        private readonly ttlMs: number = 60_000  // Default: 60 second TTL
    ) {}

    async getLiveUSDCPrice(): Promise<PricingResult> {
        const now = Date.now();

        if (this.cache && (now - this.cacheTime) < this.ttlMs) {
            console.log(`[CachedPricingStrategy] ✅ Cache HIT — rate: ${this.cache.finalRate} (expires in ${Math.round((this.ttlMs - (now - this.cacheTime)) / 1000)}s)`);
            return this.cache;
        }

        console.log(`[CachedPricingStrategy] Cache MISS — fetching fresh rate...`);
        const result = await this.inner.getLiveUSDCPrice();

        if (result.success) {
            this.cache = result;
            this.cacheTime = now;
            console.log(`[CachedPricingStrategy] 🔄 Cache updated — rate: ${result.finalRate}`);
        }

        return result;
    }

    /** Manually invalidate cache (useful for testing or admin triggers). */
    invalidate(): void {
        this.cache = null;
        this.cacheTime = 0;
        console.log('[CachedPricingStrategy] Cache invalidated.');
    }
}
