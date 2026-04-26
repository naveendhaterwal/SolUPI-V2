/**
 * IOrderState — State Pattern Interface
 * ──────────────────────────────────────
 * OOP Principle: Open/Closed + Encapsulation
 *
 * Each concrete state encapsulates which transitions it allows,
 * preventing invalid status jumps like COMPLETED → PENDING.
 */

export type OrderStatus = 'PENDING' | 'AWAITING_PAYMENT' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

export interface IOrderState {
    readonly name: OrderStatus;
    /** Returns true if transitioning to `next` is a valid business operation. */
    canTransitionTo(next: OrderStatus): boolean;
}

/** ── Concrete States ─────────────────────────────────────────────────── **/

export class PendingState implements IOrderState {
    readonly name = 'PENDING' as const;
    canTransitionTo(next: OrderStatus): boolean {
        return ['AWAITING_PAYMENT', 'PROCESSING', 'CANCELLED'].includes(next);
    }
}

export class AwaitingPaymentState implements IOrderState {
    readonly name = 'AWAITING_PAYMENT' as const;
    canTransitionTo(next: OrderStatus): boolean {
        return ['PENDING', 'PROCESSING', 'CANCELLED'].includes(next);
    }
}

export class ProcessingState implements IOrderState {
    readonly name = 'PROCESSING' as const;
    canTransitionTo(next: OrderStatus): boolean {
        // PROCESSING can roll back to PENDING on failure, or move to COMPLETED/FAILED
        return ['PENDING', 'COMPLETED', 'FAILED'].includes(next);
    }
}

export class CompletedState implements IOrderState {
    readonly name = 'COMPLETED' as const;
    canTransitionTo(_next: OrderStatus): boolean {
        // Terminal state — no transitions allowed
        return false;
    }
}

export class FailedState implements IOrderState {
    readonly name = 'FAILED' as const;
    canTransitionTo(next: OrderStatus): boolean {
        // Allow retry by going back to PENDING
        return next === 'PENDING';
    }
}

export class CancelledState implements IOrderState {
    readonly name = 'CANCELLED' as const;
    canTransitionTo(_next: OrderStatus): boolean {
        // Terminal state — no transitions allowed
        return false;
    }
}
