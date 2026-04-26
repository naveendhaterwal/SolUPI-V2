import { IPricingStrategy, PricingResult } from '../IPricingStrategy';

/**
 * LoggedPricingStrategy — Decorator Pattern
 * ───────────────────────────────────────────
 * OOP Principles: Open/Closed, Single Responsibility
 *
 * Transparently wraps any IPricingStrategy to add structured logging
 * with timing information. Compose with CachedPricingStrategy:
 *
 *   const pricing = new LoggedPricingStrategy(
 *       new CachedPricingStrategy(new ExchangeRateApiStrategy())
 *   );
 */
export class LoggedPricingStrategy implements IPricingStrategy {
    constructor(private readonly inner: IPricingStrategy) {}

    async getLiveUSDCPrice(): Promise<PricingResult> {
        const start = Date.now();
        console.log('[LoggedPricingStrategy] Fetching USDC price...');

        const result = await this.inner.getLiveUSDCPrice();
        const elapsed = Date.now() - start;

        if (result.success) {
            console.log(
                `[LoggedPricingStrategy] ✅ Price fetched in ${elapsed}ms — ` +
                `raw: ${result.rawRate}, markup: ${result.markup}, final: ${result.finalRate}`
            );
        } else {
            console.warn(
                `[LoggedPricingStrategy] ⚠️ Using fallback rate: ${result.finalRate} (after ${elapsed}ms)`
            );
        }

        return result;
    }
}
