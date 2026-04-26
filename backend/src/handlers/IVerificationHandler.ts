import { Order, EmailTransaction } from '@prisma/client';

/**
 * VerificationContext — Shared state object passed through the chain.
 * Each handler reads from it and enriches it before passing to the next.
 */
export interface VerificationContext {
    utrNumber: string;
    order?: Order | null;
    emailTx?: EmailTransaction | null;
    usdcAmount?: number;
    rate?: number;
    txSignature?: string;
    recipientTokenAccount?: string;
    /** Set by any handler to abort the chain early with an error. */
    error?: string;
    /** Set to true by the final handler on full success. */
    completed?: boolean;
}

/**
 * IVerificationHandler — Chain of Responsibility Interface
 * ─────────────────────────────────────────────────────────
 * OOP Principles: Open/Closed, Single Responsibility,
 *                 Liskov Substitution, Interface Segregation
 *
 * Problem solved: `verifyUTRAndCompleteOrder` was a 189-line god-method
 * with 8 tightly coupled validation steps. This interface breaks each
 * step into a discrete handler. Handlers can be added, removed, or
 * reordered without touching any other handler.
 */
export interface IVerificationHandler {
    setNext(handler: IVerificationHandler): IVerificationHandler;
    handle(context: VerificationContext): Promise<VerificationContext>;
}

/**
 * BaseVerificationHandler — Abstract base class.
 * Implements the chain-linking mechanics so concrete handlers
 * only need to override `handle()`.
 */
export abstract class BaseVerificationHandler implements IVerificationHandler {
    private nextHandler: IVerificationHandler | null = null;

    setNext(handler: IVerificationHandler): IVerificationHandler {
        this.nextHandler = handler;
        return handler;  // Enables fluent chaining: h1.setNext(h2).setNext(h3)
    }

    async handle(context: VerificationContext): Promise<VerificationContext> {
        // If a previous handler set an error, short-circuit immediately.
        if (context.error) return context;
        return this.process(context);
    }

    /**
     * Override this in each concrete handler.
     * Call `this.passToNext(context)` to continue the chain,
     * or return `context` (with `context.error` set) to abort.
     */
    protected abstract process(context: VerificationContext): Promise<VerificationContext>;

    /** Passes the enriched context to the next handler, if one exists. */
    protected async passToNext(context: VerificationContext): Promise<VerificationContext> {
        if (this.nextHandler) {
            return this.nextHandler.handle(context);
        }
        return context;
    }
}
