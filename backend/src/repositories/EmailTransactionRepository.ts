import { PrismaClient, Prisma } from '@prisma/client';

export class EmailTransactionRepository {
    constructor(private prisma: PrismaClient) {}

    async create(data: Prisma.EmailTransactionCreateInput) {
        try {
            return await this.prisma.emailTransaction.create({ data });
        } catch (error: any) {
             if (error.code === 'P2002') {
                 throw new Error(`Transaction with RRN ${data.rrn} already exists.`);
             }
             throw error;
        }
    }

    async findByRrn(rrn: string) {
        return this.prisma.emailTransaction.findUnique({
            where: { rrn }
        });
    }

    async markAsUsed(id: string) {
        return this.prisma.emailTransaction.update({
            where: { id },
            data: { isUsed: true }
        });
    }
}
