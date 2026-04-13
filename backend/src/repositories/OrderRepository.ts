import { PrismaClient, Prisma, Order, User } from '@prisma/client';

export class OrderRepository {
    constructor(private prisma: PrismaClient) {}

    async createOrderAndUser(userId: string, amount: number, walletAddress: string): Promise<{ user: User; order: Order }> {
        // Upsert user to ensure they exist with the provided wallet address
        const user = await this.prisma.user.upsert({
            where: { id: userId },
            update: { walletAddr: walletAddress },
            create: {
                id: userId,
                email: `${userId}@example.com`,
                name: "SolUPI User",
                walletAddr: walletAddress,
                password: "placeholder_hash"
            }
        });

        // Create the order
        const order = await this.prisma.order.create({
            data: {
                userId: userId,
                amount: amount,
                walletAddr: walletAddress,
                status: "PENDING"
            }
        });

        return { user, order };
    }

    async findUserOrders(whereClause: Prisma.OrderWhereInput, orderBy: Prisma.OrderOrderByWithRelationInput, skip: number, take: number) {
        return this.prisma.$transaction([
            this.prisma.order.findMany({
                where: whereClause,
                orderBy: orderBy,
                skip: skip,
                take: take,
                include: { user: true }
            }),
            this.prisma.order.count({ where: whereClause })
        ]);
    }

    async findByIdAndUser(orderId: string, userId: string) {
        return this.prisma.order.findFirst({
            where: { id: orderId, userId: userId }
        });
    }

    async findById(orderId: string) {
        return this.prisma.order.findUnique({
            where: { id: orderId }
        });
    }

    async delete(orderId: string) {
        return this.prisma.order.delete({
            where: { id: orderId }
        });
    }

    async updateUtr(orderId: string, utrNumber: string) {
        return this.prisma.order.update({
            where: { id: orderId },
            data: {
                utrNumber: utrNumber,
                updatedAt: new Date()
            },
            include: { user: true }
        });
    }

    async findByUtr(utrNumber: string) {
        return this.prisma.order.findFirst({
            where: { utrNumber: utrNumber }
        });
    }

    async claimOrderForProcessing(orderId: string, validStatuses: string[]): Promise<boolean> {
        const result = await this.prisma.order.updateMany({
            where: {
                id: orderId,
                status: { in: validStatuses }
            },
            data: { status: 'PROCESSING' }
        });
        return result.count > 0;
    }

    async updateStatus(where: Prisma.OrderWhereInput, status: string) {
        return this.prisma.order.updateMany({
            where,
            data: { status }
        });
    }

    async updateCompleted(orderId: string, txSignature: string, recipientTokenAccount: string | null) {
        return this.prisma.order.update({
            where: { id: orderId },
            data: {
                status: 'COMPLETED',
                txSignature: txSignature,
                recipientTokenAccount: recipientTokenAccount,
                completedAt: new Date()
            }
        });
    }
}
