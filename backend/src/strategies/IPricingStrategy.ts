export interface PricingResult {
    success: boolean;
    rawRate?: number;
    markup?: number;
    finalRate: number;
    isFallback?: boolean;
}

export interface IPricingStrategy {
    getLiveUSDCPrice(): Promise<PricingResult>;
}
