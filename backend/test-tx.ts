import { Keypair, Transaction, SystemProgram, PublicKey, Connection } from '@solana/web3.js';
import bs58 from 'bs58';
import * as dotenv from 'dotenv';
dotenv.config();

async function main() {
    const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
    const connection = new Connection(rpcUrl, 'finalized');
    
    // Load wallet
    const privateKeyString = process.env.PRIVATE_KEY;
    if (!privateKeyString) throw new Error("Missing PRIVATE_KEY");
    const privateKeyBytes = bs58.decode(privateKeyString);
    const wallet = Keypair.fromSecretKey(privateKeyBytes);

    console.log(`Using wallet: ${wallet.publicKey.toString()}`);

    // Get Blockhash via HTTP
    const blockhashResponse = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'getLatestBlockhash',
            params: [{ commitment: 'finalized' }]
        })
    }).then(res => res.json());

    const blockhash = blockhashResponse.result.value.blockhash;
    console.log(`Got blockhash: ${blockhash}`);

    // Create a simple self-transfer 0 SOL transaction to test
    const tx = new Transaction();
    tx.recentBlockhash = blockhash;
    tx.feePayer = wallet.publicKey;
    tx.add(SystemProgram.transfer({
        fromPubkey: wallet.publicKey,
        toPubkey: wallet.publicKey,
        lamports: 0
    }));

    tx.sign(wallet);
    
    // Base64 serialize for RPC 
    const wireTransaction = tx.serialize().toString('base64');
    
    console.log(`\nSending signed transaction via HTTP POST to Solami...`);
    const sendResponse = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            jsonrpc: '2.0',
            id: 2,
            method: 'sendTransaction',
            params: [wireTransaction, { encoding: "base64", skipPreflight: true }]
        })
    }).then(res => res.json());

    if (sendResponse.error) {
        console.error('❌ Failed to send transaction:', sendResponse.error);
    } else {
        console.log(`✅ Success! Transaction Signature: ${sendResponse.result}`);
    }
}

main().catch(console.error);
