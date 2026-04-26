import { BaseVerificationHandler, VerificationContext } from './IVerificationHandler';
import { OrderRepository } from '../repositories/OrderRepository';
import { EmailTransactionRepository } from '../repositories/EmailTransactionRepository';
import { OrderStateMachine } from '../states/OrderStateMachine';
import { SolanaFacade } from '../facades/SolanaFacade';
import { PayoutUnitOfWork } from '../uow/PayoutUnitOfWork';

// ─────────────────────────────────────────────────────────────
// Handler 1 — Verify the order with this UTR exists
// ─────────────────────────────────────────────────────────────
export class OrderExistsHandler extends BaseVerificationHandler {
    constructor(private repo: OrderRepository) { super(); }

    protected async process(ctx: VerificationContext): Promise<VerificationContext> {
        const order = await this.repo.findByUtr(ctx.utrNumber);
        if (!order) {
            ctx.error = `Order with UTR "${ctx.utrNumber}" not found in database.`;
            console.log(`[OrderExistsHandler] ❌ ${ctx.error}`);
            return ctx;
        }
        console.log(`[OrderExistsHandler] ✅ Found order ${order.id} (status: ${order.status})`);
        ctx.order = order;
        return this.passToNext(ctx);
    }
}

// ─────────────────────────────────────────────────────────────
// Handler 2 — Ensure the order is in a processable status
// ─────────────────────────────────────────────────────────────
export class OrderStatusHandler extends BaseVerificationHandler {
    constructor(private stateMachine: OrderStateMachine) { super(); }

    protected async process(ctx: VerificationContext): Promise<VerificationContext> {
        const { status } = ctx.order!;
        const canProcess = this.stateMachine.canTransition(status, 'PROCESSING');
        if (!canProcess) {
            ctx.error = `Order is already in "${status}" state. Skipping.`;
            console.log(`[OrderStatusHandler] ℹ️ ${ctx.error}`);
            return ctx;
        }
        console.log(`[OrderStatusHandler] ✅ Order status "${status}" can transition to PROCESSING.`);
        return this.passToNext(ctx);
    }
}

// ─────────────────────────────────────────────────────────────
// Handler 3 — Confirm email transaction exists for this UTR
// ─────────────────────────────────────────────────────────────
export class EmailTransactionHandler extends BaseVerificationHandler {
    constructor(private emailRepo: EmailTransactionRepository) { super(); }

    protected async process(ctx: VerificationContext): Promise<VerificationContext> {
        const emailTx = await this.emailRepo.findByRrn(ctx.utrNumber);
        if (!emailTx) {
            ctx.error = 'Payment not received yet — email transaction not found.';
            console.log(`[EmailTransactionHandler] ⏳ ${ctx.error}`);
            return ctx;
        }
        if (emailTx.isUsed) {
            ctx.error = `UTR "${ctx.utrNumber}" has already been used for a previous payout.`;
            console.log(`[EmailTransactionHandler] ❌ ${ctx.error}`);
            return ctx;
        }
        console.log(`[EmailTransactionHandler] ✅ Email tx ${emailTx.id} found. Amount: ₹${emailTx.amount}`);
        ctx.emailTx = emailTx;
        return this.passToNext(ctx);
    }
}

// ─────────────────────────────────────────────────────────────
// Handler 4 — Verify paid amount matches order amount
// ─────────────────────────────────────────────────────────────
export class AmountValidationHandler extends BaseVerificationHandler {
    protected async process(ctx: VerificationContext): Promise<VerificationContext> {
        const paidAmount   = Number(ctx.emailTx!.amount);
        const orderAmount  = Number(ctx.order!.amount);
        const BUFFER_INR   = 1; // Allow ₹1 rounding tolerance

        if (paidAmount < (orderAmount - BUFFER_INR)) {
            ctx.error = `Payment ₹${paidAmount} is less than required ₹${orderAmount}.`;
            console.log(`[AmountValidationHandler] ❌ ${ctx.error}`);
            return ctx;
        }
        console.log(`[AmountValidationHandler] ✅ Amount OK — Paid: ₹${paidAmount}, Required: ₹${orderAmount}`);
        return this.passToNext(ctx);
    }
}

// ─────────────────────────────────────────────────────────────
// Handler 5 — Atomically claim the order (prevents race conditions)
// ─────────────────────────────────────────────────────────────
export class OrderClaimHandler extends BaseVerificationHandler {
    constructor(private repo: OrderRepository) { super(); }

    protected async process(ctx: VerificationContext): Promise<VerificationContext> {
        const claimed = await this.repo.claimOrderForProcessing(
            ctx.order!.id,
            ['PENDING', 'AWAITING_PAYMENT']
        );
        if (!claimed) {
            ctx.error = 'Order was already claimed by another process. Skipping.';
            console.log(`[OrderClaimHandler] ⚠️ ${ctx.error}`);
            return ctx;
        }
        console.log(`[OrderClaimHandler] 🔒 Order ${ctx.order!.id} locked for processing.`);
        return this.passToNext(ctx);
    }
}

// ─────────────────────────────────────────────────────────────
// Handler 6 — Calculate USDC amount using the Facade + Pricing Strategy
// ─────────────────────────────────────────────────────────────
export class USDCCalculationHandler extends BaseVerificationHandler {
    constructor(private solana: SolanaFacade, private repo: OrderRepository) { super(); }

    protected async process(ctx: VerificationContext): Promise<VerificationContext> {
        const calc = await this.solana.calculateUSDCAmount(Number(ctx.order!.amount));
        if (!calc.success || !calc.usdcAmount) {
            ctx.error = 'USDC calculation failed. Reverting order to PENDING.';
            console.log(`[USDCCalculationHandler] ❌ ${ctx.error}`);
            await this.repo.updateStatus({ id: ctx.order!.id }, 'PENDING');
            return ctx;
        }
        console.log(`[USDCCalculationHandler] ✅ ${calc.usdcAmount} USDC at rate ${calc.rate} INR/USDC`);
        ctx.usdcAmount = calc.usdcAmount;
        ctx.rate       = calc.rate;
        return this.passToNext(ctx);
    }
}

// ─────────────────────────────────────────────────────────────
// Handler 7 — Execute the Solana USDC transfer
// ─────────────────────────────────────────────────────────────
export class SolanaTransferHandler extends BaseVerificationHandler {
    constructor(private solana: SolanaFacade, private repo: OrderRepository) { super(); }

    protected async process(ctx: VerificationContext): Promise<VerificationContext> {
        const start  = Date.now();
        console.log(`[SolanaTransferHandler] 🚀 Sending ${ctx.usdcAmount} USDC → ${ctx.order!.walletAddr}`);

        const result = await this.solana.transferUSDC(ctx.order!.walletAddr, ctx.usdcAmount!);
        const elapsed = ((Date.now() - start) / 1000).toFixed(2);

        if (!result.success) {
            ctx.error = result.error ?? 'Solana transfer failed.';
            console.log(`[SolanaTransferHandler] ❌ Transfer failed after ${elapsed}s: ${ctx.error}. Reverting to PENDING.`);
            await this.repo.updateStatus({ id: ctx.order!.id }, 'PENDING');
            return ctx;
        }

        console.log(`[SolanaTransferHandler] ✅ Transfer confirmed in ${elapsed}s — sig: ${result.signature}`);
        ctx.txSignature           = result.signature;
        ctx.recipientTokenAccount = result.recipientTokenAccount;
        return this.passToNext(ctx);
    }
}

// ─────────────────────────────────────────────────────────────
// Handler 8 — Atomically mark order COMPLETED + UTR as used (UoW)
// ─────────────────────────────────────────────────────────────
export class OrderCompletionHandler extends BaseVerificationHandler {
    constructor(private uow: PayoutUnitOfWork) { super(); }

    protected async process(ctx: VerificationContext): Promise<VerificationContext> {
        await this.uow.execute({
            orderId:               ctx.order!.id,
            emailTxId:             ctx.emailTx!.id,
            txSignature:           ctx.txSignature!,
            recipientTokenAccount: ctx.recipientTokenAccount ?? '',
        });

        ctx.completed = true;
        console.log(`[OrderCompletionHandler] 🎉 Order ${ctx.order!.id} fully completed!`);
        return ctx;
    }
}
