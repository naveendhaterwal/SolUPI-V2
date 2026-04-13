import {
    Connection,
    PublicKey,
    Keypair,
    LAMPORTS_PER_SOL
} from '@solana/web3.js';
import {
    getOrCreateAssociatedTokenAccount,
    transfer
} from '@solana/spl-token';
import bs58 from 'bs58';
import { IPricingStrategy } from '../strategies/IPricingStrategy';

export class SolanaFacade {
    private connection: Connection;
    private network: string;
    private usdcMint: PublicKey;
    private platformWallet: Keypair | null = null;
    private platformTokenAccount: any = null;

    constructor(private pricingStrategy: IPricingStrategy) {
        const rpcUrl = process.env.SOLANA_RPC_URL || process.env.RPC_URL || 'https://api.devnet.solana.com';
        this.network = process.env.SOLANA_NETWORK || 'devnet';
        this.connection = new Connection(rpcUrl, 'confirmed');
        this.usdcMint = new PublicKey(process.env.USDC_MINT_ADDRESS || 'Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr');
    }

    async initialize(): Promise<void> {
        if (this.platformWallet) return;

        const privateKey = process.env.PRIVATE_KEY;
        if (!privateKey) throw new Error("private key not found");

        const privateKeyBytes = bs58.decode(privateKey);
        this.platformWallet = Keypair.fromSecretKey(privateKeyBytes);
        
        console.log('Platform wallet loaded:', this.platformWallet.publicKey.toString());
        
        this.platformTokenAccount = await getOrCreateAssociatedTokenAccount(
            this.connection,
            this.platformWallet,
            this.usdcMint,
            this.platformWallet.publicKey
        );
        console.log('Platform USDC account:', this.platformTokenAccount.address.toString());
    }

    isValidAddress(address: string): boolean {
        try {
            new PublicKey(address);
            return true;
        } catch {
            return false;
        }
    }

    async calculateUSDCAmount(inrAmount: number) {
        const priceData = await this.pricingStrategy.getLiveUSDCPrice();
        const rate = priceData.finalRate;
        const usdcAmount = inrAmount / rate;
        const roundedUSDC = Math.round(usdcAmount * 100) / 100;
        
        return {
            success: true,
            usdcAmount: roundedUSDC,
            inrAmount: inrAmount,
            rate: rate
        };
    }

    private async withRetry<T>(operation: () => Promise<T>, retries = 3, delay = 1000): Promise<T> {
        try {
            return await operation();
        } catch (error) {
            if (retries > 0) {
                console.log(`⚠️ Operation failed, retrying... (${retries} attempts left)`);
                await new Promise(resolve => setTimeout(resolve, delay));
                return this.withRetry(operation, retries - 1, delay * 2);
            }
            throw error;
        }
    }

    async transferUSDC(recipientAddress: string, amountInUSDC: number) {
        try {
            await this.initialize();

            if (!this.isValidAddress(recipientAddress)) {
                return { success: false, error: 'Invalid recipient wallet address' };
            }

            const recipientPublicKey = new PublicKey(recipientAddress);
            
            const recipientTokenAccount = await this.withRetry(() => getOrCreateAssociatedTokenAccount(
                this.connection,
                this.platformWallet!,
                this.usdcMint,
                recipientPublicKey,
                true
            ));

            const amountInSmallestUnits = Math.floor(amountInUSDC * 1000000);
            const platformBalance = await this.withRetry(() => this.connection.getTokenAccountBalance(this.platformTokenAccount.address));
            const platformBalanceAmount = parseInt(platformBalance.value.amount);

            if (platformBalanceAmount < amountInSmallestUnits) {
                return { success: false, error: `Insufficient USDC balance.` };
            }

            const signature = await this.withRetry(() => transfer(
                this.connection,
                this.platformWallet!,
                this.platformTokenAccount.address,
                recipientTokenAccount.address,
                this.platformWallet!.publicKey,
                amountInSmallestUnits,
                []
            ));

            return {
                success: true,
                signature: signature,
                amount: amountInUSDC,
                recipientTokenAccount: recipientTokenAccount.address.toString()
            };

        } catch (error: any) {
            console.error('❌ Error transferring USDC:', error);
            return { success: false, error: error.message };
        }
    }
}
