import axios from "axios";
import { IPricingStrategy, PricingResult } from "./IPricingStrategy";

const Markup_percent = 2.5;

export class ExchangeRateApiStrategy implements IPricingStrategy {
    private apiUrl: string;

    constructor() {
        this.apiUrl = `https://v6.exchangerate-api.com/v6/${process.env.EXCHANGE_RATE_API_KEY}/latest/USD`;
    }

    async getLiveUSDCPrice(): Promise<PricingResult> {
        try {
            const response = await axios.get(this.apiUrl);
            const data = response.data;
            const usdcPrice = data.conversion_rates.INR;
            const markupPrice = usdcPrice + (usdcPrice * Markup_percent / 100);
            
            return {
                success: true,
                rawRate: usdcPrice,
                markup: markupPrice,
                finalRate: parseFloat(markupPrice.toFixed(2))
            };
        } catch (error) {
            console.error("ExchangeRateAPI error:", error);
            return {
                success: false,
                finalRate: 93,
                isFallback: true
            };
        }
    }
}
