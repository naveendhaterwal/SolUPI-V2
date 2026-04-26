import {
    Connection,
    PublicKey,
    Keypair,
    LAMPORTS_PER_SOL,
    Transaction,
    sendAndConfirmTransaction,
    ComputeBudgetProgram,
} from '@solana/web3.js';
import {
    getAssociatedTokenAddressSync,
    createAssociatedTokenAccountInstruction,
    createTransferCheckedInstruction,
    TOKEN_PROGRAM_ID
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
        this.network = process.env.SOLANA_NETWORK || 'devnet';
        const rpcUrl = process.env.SOLANA_RPC_URL;
        const wsUrl = process.env.SOLANA_WS_URL;
        
        if (!rpcUrl) throw new Error("SOLANA_RPC_URL must be defined in .env");
        
        console.log(`[SolanaFacade] Connecting to RPC: ${rpcUrl}`);
        this.connection = new Connection(rpcUrl, {
            commitment: 'confirmed',
            wsEndpoint: wsUrl || undefined,
            confirmTransactionInitialTimeout: 60000
        });

        this.usdcMint = new PublicKey(process.env.USDC_MINT_ADDRESS || 'Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr');
    }

    async initialize(): Promise<void> {
        if (this.platformWallet) return;

        const privateKey = process.env.PRIVATE_KEY;
        if (!privateKey) throw new Error("private key not found");

        const privateKeyBytes = bs58.decode(privateKey);
        this.platformWallet = Keypair.fromSecretKey(privateKeyBytes);
        
        console.log('Platform wallet loaded:', this.platformWallet.publicKey.toString());
        
        this.platformTokenAccount = {
            address: getAssociatedTokenAddressSync(
                this.usdcMint,
                this.platformWallet.publicKey
            )
        };
        console.log('Platform USDC account:', this.platformTokenAccount.address.toString());

        // ✅ Guard: Fail fast if wrong network or insufficient balance
        await this.assertSufficientBalance();
    }

    private async assertSufficientBalance(): Promise<void> {
        const MIN_SOL = 0.05 * LAMPORTS_PER_SOL;
        const solBalance = await this.connection.getBalance(this.platformWallet!.publicKey);
        if (solBalance < MIN_SOL) {
            throw new Error(
                `[SolanaFacade] FATAL: Platform wallet has only ${solBalance / LAMPORTS_PER_SOL} SOL. ` +
                `Minimum 0.05 SOL required for fees. ` +
                `Check SOLANA_RPC_URL — it may be pointing to the wrong network.`
            );
        }
        try {
            const tokenBalance = await this.connection.getTokenAccountBalance(this.platformTokenAccount.address);
            console.log(`[SolanaFacade] ✅ Balances OK — SOL: ${solBalance / LAMPORTS_PER_SOL}, USDC: ${tokenBalance.value.uiAmount}`);
        } catch {
            throw new Error(
                `[SolanaFacade] FATAL: Platform USDC token account not found on this network. ` +
                `Check SOLANA_RPC_URL and USDC_MINT_ADDRESS.`
            );
        }
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

    private async withRetry<T>(operation: () => Promise<T>, retries = 3, delay = 2000): Promise<T> {
        try {
            return await operation();
        } catch (error: any) {
            if (retries > 0) {
                console.log(`⚠️ Operation failed, retrying in ${delay}ms... (${retries} attempts left). Error: ${error.message}`);
                await new Promise(resolve => setTimeout(resolve, delay));
                return this.withRetry(operation, retries - 1, delay * 2);
            }
            throw error;
        }
    }

    async transferUSDC(recipientAddress: string, amountInUSDC: number) {
        try {
            console.log(`[SolanaFacade] Starting transferUSDC to ${recipientAddress} for ${amountInUSDC} USDC`);
            await this.initialize();
            
            if (!this.isValidAddress(recipientAddress)) {
                return { success: false, error: 'Invalid recipient wallet address' };
            }

            const recipientPublicKey = new PublicKey(recipientAddress);
            const recipientATA = getAssociatedTokenAddressSync(this.usdcMint, recipientPublicKey, true);
            
            console.log(`[SolanaFacade] Recipient ATA Derived: ${recipientATA.toString()}`);

            // 1. Ensure Recipient ATA exists
            const accountInfo = await this.withRetry(() => 
                this.connection.getAccountInfo(recipientATA)
            );
            
            if (!accountInfo) {
                console.log(`[SolanaFacade] Recipient ATA does not exist. Creating...`);
                const transaction = new Transaction().add(
                    createAssociatedTokenAccountInstruction(
                        this.platformWallet!.publicKey,
                        recipientATA,
                        recipientPublicKey,
                        this.usdcMint
                    )
                );
                const txSignature = await this.sendAndConfirm(transaction);
                console.log(`[SolanaFacade] ATA Created. Signature: ${txSignature}`);
            }

            // 2. Execute Transfer
            const amountInSmallestUnits = Math.floor(amountInUSDC * 1000000);
            console.log(`[SolanaFacade] Transferring tokens... Smallest units: ${amountInSmallestUnits}`);
            
            const transaction = new Transaction().add(
                createTransferCheckedInstruction(
                    this.platformTokenAccount.address,
                    this.usdcMint,
                    recipientATA,
                    this.platformWallet!.publicKey,
                    amountInSmallestUnits,
                    6 // USDC decimals
                )
            );
            
            const signature = await this.sendAndConfirm(transaction);
            console.log(`[SolanaFacade] Transfer signature confirmed:`, signature);

            return {
                success: true,
                signature: signature,
                amount: amountInUSDC,
                recipientTokenAccount: recipientATA.toString()
            };

        } catch (error: any) {
            console.error('❌ Error transferring USDC:', error);
            return { success: false, error: error.message };
        }
    }

    private async sendAndConfirm(transaction: Transaction): Promise<string> {
        // Add Priority Fees to help land on devnet
        transaction.add(ComputeBudgetProgram.setComputeUnitLimit({ units: 100000 }));
        transaction.add(ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 200000 })); 

        const signature = await sendAndConfirmTransaction(
            this.connection,
            transaction,
            [this.platformWallet!],
            {
                commitment: 'confirmed',
                preflightCommitment: 'confirmed',
                skipPreflight: false,
                maxRetries: 3
            }
        );

        console.log(`[SolanaFacade] Transaction confirmed on-chain!`);
        return signature;
    }
}
