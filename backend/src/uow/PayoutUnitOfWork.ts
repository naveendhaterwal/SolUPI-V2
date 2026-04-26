import { PrismaClient } from '@prisma/client';

/**
 * PayoutUnitOfWork — Unit of Work Pattern
 * ────────────────────────────────────────
 * OOP Principle: Atomicity / Single Responsibility
 *
 * Problem solved: If the server crashed after `order.update(COMPLETED)`
 * but before `emailTransaction.update(isUsed=true)`, the UTR could be
 * replayed → double-spend. This UoW wraps both writes in a single
 * Prisma `$transaction`, ensuring all-or-nothing semantics.
 */
export class PayoutUnitOfWork {
    constructor(private readonly prisma: PrismaClient) {}

    /**
     * Atomically marks an order as COMPLETED and the email transaction
     * as used. Either both writes commit or neither does.
     */
    async execute(params: {
        orderId: string;
        emailTxId: string;
        txSignature: string;
        recipientTokenAccount: string;
    }): Promise<void> {
        const { orderId, emailTxId, txSignature, recipientTokenAccount } = params;

        await this.prisma.$transaction([
            this.prisma.order.update({
                where: { id: orderId },
                data: {
                    status: 'COMPLETED',
                    txSignature,
                    recipientTokenAccount,
                    completedAt: new Date(),
                },
            }),
            this.prisma.emailTransaction.update({
                where: { id: emailTxId },
                data: { isUsed: true },
            }),
        ]);

        console.log(
            `[PayoutUnitOfWork] ✅ Atomic commit — Order ${orderId} COMPLETED, ` +
            `EmailTx ${emailTxId} marked isUsed.`
        );
    }
}
