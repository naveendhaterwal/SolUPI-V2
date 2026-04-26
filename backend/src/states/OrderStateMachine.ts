import {
    IOrderState,
    OrderStatus,
    PendingState,
    AwaitingPaymentState,
    ProcessingState,
    CompletedState,
    FailedState,
    CancelledState,
} from './IOrderState';

/**
 * OrderStateMachine — State Pattern
 * ───────────────────────────────────
 * OOP Principles: Open/Closed, Encapsulation, Single Responsibility
 *
 * Problem solved: Status transitions were scattered across OrderService
 * as raw string comparisons. Invalid moves (e.g. COMPLETED → PENDING)
 * silently passed. This machine validates every transition centrally.
 *
 * Usage:
 *   stateMachine.assertTransition(order.status, 'PROCESSING');  // throws if invalid
 *   const isOk = stateMachine.canTransition(order.status, 'COMPLETED');
 */
export class OrderStateMachine {
    private readonly states = new Map<OrderStatus, IOrderState>([
        ['PENDING',          new PendingState()],
        ['AWAITING_PAYMENT', new AwaitingPaymentState()],
        ['PROCESSING',       new ProcessingState()],
        ['COMPLETED',        new CompletedState()],
        ['FAILED',           new FailedState()],
        ['CANCELLED',        new CancelledState()],
    ]);

    /** Returns whether a transition from `from` to `to` is valid. */
    canTransition(from: string, to: OrderStatus): boolean {
        const state = this.states.get(from as OrderStatus);
        return state?.canTransitionTo(to) ?? false;
    }

    /**
     * Asserts a transition is valid. Throws `InvalidTransitionError` if not.
     * Use this before any DB status update to catch bugs early.
     */
    assertTransition(from: string, to: OrderStatus): void {
        if (!this.canTransition(from, to)) {
            throw new InvalidTransitionError(from, to);
        }
    }

    /** Returns the state object for a given status. */
    getState(status: string): IOrderState {
        const state = this.states.get(status as OrderStatus);
        if (!state) throw new Error(`[OrderStateMachine] Unknown status: "${status}"`);
        return state;
    }
}

/** Thrown when an illegal state transition is attempted. */
export class InvalidTransitionError extends Error {
    constructor(from: string, to: string) {
        super(
            `[OrderStateMachine] ILLEGAL TRANSITION: "${from}" → "${to}". ` +
            `This status change is not permitted by business rules.`
        );
        this.name = 'InvalidTransitionError';
    }
}
