import {
    Connection,
    PublicKey,
    Keypair,
    LAMPORTS_PER_SOL
} from '@solana/web3.js';
import {
    getAssociatedTokenAddressSync,
    createAssociatedTokenAccountInstruction,
    createTransferCheckedInstruction,
    TOKEN_PROGRAM_ID
} from '@solana/spl-token';
import {
    Transaction,
    sendAndConfirmRawTransaction,
} from '@solana/web3.js';
import bs58 from 'bs58';
import { IPricingStrategy } from '../strategies/IPricingStrategy';

export class SolanaFacade {
    private connection: Connection;
    private network: string;
    private usdcMint: PublicKey;
    private platformWallet: Keypair | null = null;
    private platformTokenAccount: any = null;

    private rpcUrls: string[] = [];
    private currentRpcIndex = 0;

    constructor(private pricingStrategy: IPricingStrategy) {
        this.network = process.env.SOLANA_NETWORK || 'devnet';
        const envRpc = process.env.SOLANA_RPC_URL;
        if (!envRpc) throw new Error("SOLANA_RPC_URL must be defined in .env");
        this.rpcUrls = [envRpc];
        this.setupConnection();
        this.usdcMint = new PublicKey(process.env.USDC_MINT_ADDRESS || 'Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr');
    }

    private setupConnection() {
        const rpcUrl = this.rpcUrls[this.currentRpcIndex];
        console.log(`[SolanaFacade] Connecting to RPC: ${rpcUrl}`);
        this.connection = new Connection(rpcUrl, {
            commitment: 'finalized',
            wsEndpoint: undefined,
            confirmTransactionInitialTimeout: 60000
        });
    }

    private rotateRpc() {
        this.currentRpcIndex = (this.currentRpcIndex + 1) % this.rpcUrls.length;
        console.log(`[SolanaFacade] Rotating to next RPC...`);
        this.setupConnection();
    }

    async initialize(): Promise<void> {
        if (this.platformWallet) return;

        const privateKey = process.env.PRIVATE_KEY;
        if (!privateKey) throw new Error("private key not found");

        const privateKeyBytes = bs58.decode(privateKey);
        this.platformWallet = Keypair.fromSecretKey(privateKeyBytes);
        
        console.log('Platform wallet loaded:', this.platformWallet.publicKey.toString());
        
        // Derive offline to prevent Devnet StructError crashes
        this.platformTokenAccount = {
            address: getAssociatedTokenAddressSync(
                this.usdcMint,
                this.platformWallet.publicKey
            )
        };
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

    private async withRetry<T>(operation: () => Promise<T>, retries = 3, delay = 2000): Promise<T> {
        try {
            const timeoutPromise = new Promise<T>((_, reject) =>
                setTimeout(() => reject(new Error('Operation timed out after 90 seconds')), 90000)
            );
            return await Promise.race([operation(), timeoutPromise]);
        } catch (error: any) {
            const isRateLimit = error.message.includes('429') || error.message.includes('503');
            
            if (error.message.includes('blockhash') || error.message.includes('fetch') || error.message.includes('timed out') || isRateLimit) {
                this.rotateRpc();
            }

            if (retries > 0) {
                const backoff = isRateLimit ? delay * 3 : delay * 2;
                console.log(`⚠️ Operation failed, retrying in ${backoff}ms... (${retries} attempts left). Error: ${error.message}`);
                await new Promise(resolve => setTimeout(resolve, backoff));
                return this.withRetry(operation, retries - 1, backoff);
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
            const accountInfoResponse = await this.withRetry(() => 
                this.rawRequest('getAccountInfo', [recipientATA.toString(), { encoding: 'base64' }])
            );
            const accountInfo = accountInfoResponse?.result?.value;
            
            if (!accountInfo) {
                console.log(`[SolanaFacade] Recipient ATA does not exist. Creating...`);
                await this.withRetry(async () => {
                    const transaction = new Transaction().add(
                        createAssociatedTokenAccountInstruction(
                            this.platformWallet!.publicKey,
                            recipientATA,
                            recipientPublicKey,
                            this.usdcMint
                        )
                    );
                    const txSignature = await this.sendAndPoll(transaction);
                    console.log(`[SolanaFacade] ATA Created. Signature: ${txSignature}`);
                    return txSignature;
                });
            }

            // 2. Execute Transfer
            const amountInSmallestUnits = Math.floor(amountInUSDC * 1000000);
            console.log(`[SolanaFacade] Transferring tokens... Smallest units: ${amountInSmallestUnits}`);
            
            const signature = await this.withRetry(async () => {
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
                
                return await this.sendAndPoll(transaction);
            });
            
            console.log(`[SolanaFacade] Transfer signature verified:`, signature);

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

    private async sendAndPoll(transaction: Transaction): Promise<string> {
        const blockhashResponse = await this.rawRequest('getLatestBlockhash', [{ commitment: 'finalized' }]);
        
        if (blockhashResponse.error) {
            throw new Error(`RPC Error fetching blockhash: ${JSON.stringify(blockhashResponse.error)}`);
        }
        
        const blockhash = blockhashResponse?.result?.value?.blockhash;
        if (!blockhash) throw new Error("Failed to get blockhash via Raw RPC (result missing)");
        
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = this.platformWallet!.publicKey;
        
        transaction.sign(this.platformWallet!);
        
        const wireTransaction = transaction.serialize().toString('base64');
        const sendResponse = await this.rawRequest('sendTransaction', [wireTransaction, { encoding: "base64", skipPreflight: true }]);
        
        if (sendResponse.error) {
            throw new Error(`RPC Error sending transaction: ${JSON.stringify(sendResponse.error)}`);
        }
        
        const txSignature = sendResponse.result;

        console.log(`[SolanaFacade] Signature generated: ${txSignature}. Bypassing confirmation polling (Fire-and-forget).`);
        
        return txSignature;
    }

    /**
     * Helper to perform raw JSON-RPC requests to bypass library validation issues (StructError)
     */
    private async rawRequest(method: string, params: any[]): Promise<any> {
        const rpcUrl = this.rpcUrls[this.currentRpcIndex];
        try {
            const response = await fetch(rpcUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    id: 1,
                    method,
                    params
                })
            });

            if (!response.ok) {
                const body = await response.text().catch(() => 'No body');
                throw new Error(`RPC Request failed with status ${response.status}: ${body.substring(0, 100)}`);
            }

            return await response.json();
        } catch (e: any) {
            if (e.message.includes('status')) throw e;
            throw new Error(`Fetch transport error: ${e.message}`);
        }
    }
}
