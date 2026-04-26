/**
 * AppConfig — Singleton Pattern
 * ─────────────────────────────
 * OOP Principle: Single point of truth for configuration.
 * All process.env access is centralised here. Missing vars
 * throw immediately at boot rather than silently at runtime.
 */
export class AppConfig {
    private static instance: AppConfig;

    // ── Solana ──────────────────────────────────────────────
    readonly solanaRpcUrl: string;
    readonly solanaWsUrl: string | undefined;
    readonly solanaNetwork: string;
    readonly usdcMintAddress: string;
    readonly privateKey: string;

    // ── Email ────────────────────────────────────────────────
    readonly emailUser: string | undefined;
    readonly emailPass: string | undefined;

    // ── External APIs ────────────────────────────────────────
    readonly exchangeRateApiKey: string;

    // ── Server ───────────────────────────────────────────────
    readonly port: number;
    readonly frontendOrigin: string;

    private constructor() {
        this.solanaRpcUrl     = this.require('SOLANA_RPC_URL');
        this.solanaWsUrl      = process.env.SOLANA_WS_URL;
        this.solanaNetwork    = process.env.SOLANA_NETWORK ?? 'devnet';
        this.usdcMintAddress  = this.require('USDC_MINT_ADDRESS');
        this.privateKey       = this.require('PRIVATE_KEY');
        this.exchangeRateApiKey = this.require('EXCHANGE_RATE_API_KEY');
        this.emailUser        = process.env.EMAIL_USER;
        this.emailPass        = process.env.EMAIL_PASS;
        this.port             = parseInt(process.env.PORT ?? '3001', 10);
        this.frontendOrigin   = process.env.FRONTEND_ORIGIN ?? 'http://localhost:3000';

        console.log('[AppConfig] ✅ All required environment variables loaded.');
    }

    /** Returns the shared singleton instance, creating it on first call. */
    static getInstance(): AppConfig {
        if (!AppConfig.instance) {
            AppConfig.instance = new AppConfig();
        }
        return AppConfig.instance;
    }

    /** Throws a clear error if a required env var is missing. */
    private require(key: string): string {
        const value = process.env[key];
        if (!value) {
            throw new Error(
                `[AppConfig] FATAL — Missing required environment variable: "${key}". ` +
                `Please add it to your .env file.`
            );
        }
        return value;
    }
}
