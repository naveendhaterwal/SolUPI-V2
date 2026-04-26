import { OrderRepository } from '../repositories/OrderRepository';
import { SolanaFacade } from '../facades/SolanaFacade';
import { EmailTransactionRepository } from '../repositories/EmailTransactionRepository';
import { Prisma } from '@prisma/client';
import { OrderQueryBuilder } from '../builders/OrderQueryBuilder';
import { OrderStateMachine } from '../states/OrderStateMachine';
import { PayoutUnitOfWork } from '../uow/PayoutUnitOfWork';
import {
    CommandBus,
    CreateOrderCommand,
    UpdateOrderUTRCommand,
    DeleteOrderCommand,
} from '../commands/OrderCommands';
import {
    OrderExistsHandler,
    OrderStatusHandler,
    EmailTransactionHandler,
    AmountValidationHandler,
    OrderClaimHandler,
    USDCCalculationHandler,
    SolanaTransferHandler,
    OrderCompletionHandler,
} from '../handlers/VerificationHandlers';
import { VerificationContext } from '../handlers/IVerificationHandler';

/**
 * OrderService — Refactored with 5 OOP Design Patterns
 * ──────────────────────────────────────────────────────
 *
 * ✅ Builder          — OrderQueryBuilder replaces 50-line if-chain
 * ✅ State Machine    — OrderStateMachine validates every status transition
 * ✅ Unit of Work     — PayoutUnitOfWork prevents double-spend atomically
 * ✅ Chain of Resp.   — VerificationHandlers replaces 189-line god-method
 * ✅ Command + Bus    — CreateOrder / UpdateUTR / Delete via CommandBus
 */
export class OrderService {
    private readonly stateMachine: OrderStateMachine;
    private readonly commandBus: CommandBus;

    constructor(
        private readonly orderRepo: OrderRepository,
        private readonly solanaFacade: SolanaFacade,
        private readonly emailRepo: EmailTransactionRepository,
        private readonly uow: PayoutUnitOfWork,
    ) {
        this.stateMachine = new OrderStateMachine();
        this.commandBus   = new CommandBus();
    }

    // ─── CREATE ORDER ────────────────────────────────────────────────────
    async createOrder(userId: string, amount: number, walletAddress: string) {
        try {
            const command = new CreateOrderCommand(
                this.orderRepo, this.solanaFacade, userId, amount, walletAddress
            );
            const { user, order } = await this.commandBus.dispatch(command);
            return { success: true, data: { user, order } };
        } catch (err: any) {
            return { success: false, error: err.message };
        }
    }

    // ─── GET USER ORDERS (with Builder) ──────────────────────────────────
    async getUserOrders(
        userId: string,
        page = 1,
        limit = 10,
        status?: string | null,
        search?: string | null,
        startDate?: string | null,
        endDate?: string | null,
        sortBy = 'createdAt',
        sortOrder = 'desc',
    ) {
        try {
            const skip = (page - 1) * limit;

            // ✅ Builder Pattern — replaces the 50-line nested if-block
            const whereClause = new OrderQueryBuilder()
                .forUser(userId)
                .withStatus(status)
                .withSearch(search)
                .withDateRange(startDate, endDate)
                .build();

            const validSortFields = ['createdAt', 'amount', 'status', 'updatedAt'];
            const sortField = validSortFields.includes(sortBy) ? sortBy : 'createdAt';
            const orderBy: Prisma.OrderOrderByWithRelationInput = {
                [sortField]: sortOrder === 'asc' ? 'asc' : 'desc',
            };

            const [orders, totalCount] = await this.orderRepo.findUserOrders(
                whereClause, orderBy, skip, limit
            );

            return {
                success: true,
                data: {
                    orders,
                    pagination: { total: totalCount, page, limit, totalPages: Math.ceil(totalCount / limit) },
                },
            };
        } catch (err: any) {
            return { success: false, error: err.message };
        }
    }

    // ─── GET ORDER BY ID ──────────────────────────────────────────────────
    async getOrderById(orderId: string) {
        return this.orderRepo.findById(orderId);
    }

    // ─── DELETE ORDER ─────────────────────────────────────────────────────
    async deleteOrder(orderId: string, userId: string) {
        try {
            const command = new DeleteOrderCommand(this.orderRepo, orderId, userId);
            await this.commandBus.dispatch(command);
            return { success: true, message: 'Order deleted successfully' };
        } catch (err: any) {
            return { success: false, error: err.message };
        }
    }

    // ─── UPDATE ORDER UTR ─────────────────────────────────────────────────
    async updateOrderUTR(orderId: string, utrNumber: string, userId: string) {
        try {
            const command = new UpdateOrderUTRCommand(
                this.orderRepo, this.stateMachine, orderId, utrNumber, userId
            );
            const updatedOrder = await this.commandBus.dispatch(command);

            // Auto-trigger verification (fire-and-forget)
            this.verifyUTRAndCompleteOrder(utrNumber).catch(err => {
                console.error('[OrderService] Auto-payout failed for UTR', utrNumber, err);
            });

            return { success: true, data: updatedOrder };
        } catch (err: any) {
            return { success: false, error: err.message };
        }
    }

    // ─── VERIFY UTR & COMPLETE ORDER — Chain of Responsibility ───────────
    /**
     * Replaced the 189-line god-method with an 8-step handler chain.
     * Each handler has a Single Responsibility and can be tested in isolation.
     * The chain short-circuits on the first error or invalid state.
     */
    async verifyUTRAndCompleteOrder(utrNumber: string) {
        const logPrefix = `[verifyUTR:${utrNumber}]`;
        console.log(`${logPrefix} Starting verification chain...`);

        try {
            // ✅ Chain of Responsibility — build the chain
            const h1 = new OrderExistsHandler(this.orderRepo);
            const h2 = new OrderStatusHandler(this.stateMachine);
            const h3 = new EmailTransactionHandler(this.emailRepo);
            const h4 = new AmountValidationHandler();
            const h5 = new OrderClaimHandler(this.orderRepo);
            const h6 = new USDCCalculationHandler(this.solanaFacade, this.orderRepo);
            const h7 = new SolanaTransferHandler(this.solanaFacade, this.orderRepo);
            const h8 = new OrderCompletionHandler(this.uow);

            // Link the chain
            h1.setNext(h2).setNext(h3).setNext(h4).setNext(h5).setNext(h6).setNext(h7).setNext(h8);

            // Execute
            const context: VerificationContext = { utrNumber };
            const result = await h1.handle(context);

            if (result.error) {
                console.log(`${logPrefix} ⚠️ Chain ended with: ${result.error}`);
                return { success: false, error: result.error };
            }

            return { success: true, data: result };
        } catch (err: any) {
            console.error(`${logPrefix} 💥 UNEXPECTED ERROR:`, err);
            return { success: false, error: err.message };
        }
    }

    /** Expose audit log for admin/diagnostics endpoint. */
    getCommandAuditLog(n = 20) {
        return this.commandBus.getRecentAuditLog(n);
    }
}