import { OrderRepository } from '../repositories/OrderRepository';
import { EmailTransactionRepository } from '../repositories/EmailTransactionRepository';
import { SolanaFacade } from '../facades/SolanaFacade';
import { OrderStateMachine } from '../states/OrderStateMachine';

/**
 * ICommand — Command Pattern Interface
 * ──────────────────────────────────────
 * OOP Principles: Single Responsibility, Open/Closed, Encapsulation
 *
 * Problem solved: Order mutations (create, update, delete) were scattered
 * inline in OrderService with no audit trail and no structured retry.
 * Each command encapsulates one business operation, its inputs, and its
 * execution logic — making it independently testable and loggable.
 */
export interface ICommand<T = void> {
    /** A human-readable name for logging / audit trails. */
    readonly commandName: string;
    /** Execute the command and return a result. */
    execute(): Promise<T>;
}

/** Minimal audit-log entry recorded after each command execution. */
export interface CommandAuditEntry {
    commandName: string;
    executedAt: string;
    success: boolean;
    durationMs: number;
    error?: string;
}

/**
 * CommandBus — executes commands and maintains an in-memory audit log.
 * In production, persist the log to a DB table or append to a file.
 */
export class CommandBus {
    private auditLog: CommandAuditEntry[] = [];

    async dispatch<T>(command: ICommand<T>): Promise<T> {
        const start = Date.now();
        console.log(`[CommandBus] ▶ Dispatching: ${command.commandName}`);

        try {
            const result = await command.execute();
            const entry: CommandAuditEntry = {
                commandName: command.commandName,
                executedAt:  new Date().toISOString(),
                success:     true,
                durationMs:  Date.now() - start,
            };
            this.auditLog.push(entry);
            console.log(`[CommandBus] ✅ ${command.commandName} completed in ${entry.durationMs}ms`);
            return result;
        } catch (error: any) {
            const entry: CommandAuditEntry = {
                commandName: command.commandName,
                executedAt:  new Date().toISOString(),
                success:     false,
                durationMs:  Date.now() - start,
                error:       error.message,
            };
            this.auditLog.push(entry);
            console.error(`[CommandBus] ❌ ${command.commandName} FAILED in ${entry.durationMs}ms:`, error.message);
            throw error;
        }
    }

    /** Returns the last N audit entries (for diagnostics). */
    getRecentAuditLog(n = 20): CommandAuditEntry[] {
        return this.auditLog.slice(-n);
    }
}

// ─────────────────────────────────────────────────────────────────────────
// Concrete Commands
// ─────────────────────────────────────────────────────────────────────────

export interface CreateOrderResult {
    user: any;
    order: any;
}

/**
 * CreateOrderCommand — encapsulates the order + user creation logic.
 */
export class CreateOrderCommand implements ICommand<CreateOrderResult> {
    readonly commandName = 'CreateOrder';

    constructor(
        private repo: OrderRepository,
        private facade: SolanaFacade,
        private userId: string,
        private amount: number,
        private walletAddress: string,
    ) {}

    async execute(): Promise<CreateOrderResult> {
        if (!this.facade.isValidAddress(this.walletAddress)) {
            throw new Error('Invalid Solana wallet address');
        }
        return this.repo.createOrderAndUser(this.userId, this.amount, this.walletAddress);
    }
}

/**
 * UpdateOrderUTRCommand — encapsulates setting the UTR on an order.
 */
export class UpdateOrderUTRCommand implements ICommand<any> {
    readonly commandName = 'UpdateOrderUTR';

    constructor(
        private repo: OrderRepository,
        private stateMachine: OrderStateMachine,
        private orderId: string,
        private utrNumber: string,
        private userId: string,
    ) {}

    async execute(): Promise<any> {
        const order = await this.repo.findByIdAndUser(this.orderId, this.userId);
        if (!order) throw new Error('Order not found');

        this.stateMachine.assertTransition(order.status, 'PENDING'); // Must be PENDING
        if (order.status !== 'PENDING') throw new Error('Order is not in PENDING state');

        return this.repo.updateUtr(this.orderId, this.utrNumber);
    }
}

/**
 * DeleteOrderCommand — encapsulates order deletion with business rule enforcement.
 */
export class DeleteOrderCommand implements ICommand<void> {
    readonly commandName = 'DeleteOrder';

    constructor(
        private repo: OrderRepository,
        private orderId: string,
        private userId: string,
    ) {}

    async execute(): Promise<void> {
        const order = await this.repo.findByIdAndUser(this.orderId, this.userId);
        if (!order) throw new Error('Order not found');
        if (['COMPLETED', 'PROCESSING'].includes(order.status)) {
            throw new Error(`Cannot delete order in "${order.status}" state.`);
        }
        await this.repo.delete(this.orderId);
    }
}
