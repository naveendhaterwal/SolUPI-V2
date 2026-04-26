import { Prisma } from '@prisma/client';

/**
 * OrderQueryBuilder — Builder Pattern
 * ────────────────────────────────────
 * OOP Principle: Single Responsibility + Separation of Concerns
 *
 * Problem solved: `getUserOrders()` contained ~50 lines of nested
 * if-statements manually assembling Prisma.OrderWhereInput. This
 * builder provides a fluent, type-safe, and independently testable
 * API for constructing complex queries.
 *
 * Usage:
 *   const query = new OrderQueryBuilder()
 *       .forUser(userId)
 *       .withStatus(status)
 *       .withSearch(search)
 *       .withDateRange(startDate, endDate)
 *       .build();
 */
export class OrderQueryBuilder {
    private where: Prisma.OrderWhereInput = {};

    /** Filter orders belonging to a specific user. */
    forUser(userId: string): this {
        this.where.userId = userId;
        return this;
    }

    /** Filter by order status. Pass 'ALL' or null/undefined to skip filter. */
    withStatus(status?: string | null): this {
        if (status && status !== 'ALL') {
            // Cast as any — Prisma status enum is validated at DB level
            this.where.status = status as any;
        }
        return this;
    }

    /**
     * Full-text search across orderId, UTR number, and wallet address.
     * Case-insensitive.
     */
    withSearch(search?: string | null): this {
        if (search && search.trim()) {
            this.where.OR = [
                { id: { contains: search.trim(), mode: 'insensitive' as Prisma.QueryMode } },
                { utrNumber: { contains: search.trim(), mode: 'insensitive' as Prisma.QueryMode } },
                { walletAddr: { contains: search.trim(), mode: 'insensitive' as Prisma.QueryMode } },
            ];
        }
        return this;
    }

    /**
     * Filter orders created within an inclusive date range.
     * Both `startDate` and `endDate` are optional — pass only one if needed.
     * `endDate` is extended to 23:59:59.999 to include the full day.
     */
    withDateRange(startDate?: string | null, endDate?: string | null): this {
        if (!startDate && !endDate) return this;

        const range: Prisma.DateTimeFilter = {};
        if (startDate) range.gte = new Date(startDate);
        if (endDate) {
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            range.lte = end;
        }
        this.where.createdAt = range;
        return this;
    }

    /** Returns the fully assembled Prisma WHERE clause. */
    build(): Prisma.OrderWhereInput {
        return { ...this.where };
    }
}
