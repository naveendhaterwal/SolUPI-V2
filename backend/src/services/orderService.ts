import { OrderRepository } from '../repositories/OrderRepository';
import { SolanaFacade } from '../facades/SolanaFacade';
import { EmailTransactionRepository } from '../repositories/EmailTransactionRepository';
import { Prisma } from '@prisma/client';

export class OrderService {
    constructor(
        private orderRepo: OrderRepository,
        private solanaFacade: SolanaFacade,
        private emailRepo: EmailTransactionRepository
    ) {}

    async createOrder(userId: string, amount: number, walletAddress: string) {
        try {
            if (!this.solanaFacade.isValidAddress(walletAddress)) {
                return { success: false, error: 'Invalid Solana wallet address' };
            }
            const { user, order } = await this.orderRepo.createOrderAndUser(userId, amount, walletAddress);
            return { success: true, data: { user, order } };
        } catch (err: any) {
            return { success: false, error: err.message };
        }
    }

    async getUserOrders(userId: string, page = 1, limit = 10, status: any = null, search: any = null, startDate: any = null, endDate: any = null, sortBy = 'createdAt', sortOrder = 'desc') {
        try {
            const skip = (page - 1) * limit;
            const whereClause: Prisma.OrderWhereInput = { userId };

            if (status && status !== 'ALL') whereClause.status = status;
            if (search && search.trim()) {
                whereClause.OR = [
                    { id: { contains: search, mode: 'insensitive' as Prisma.QueryMode } },
                    { utrNumber: { contains: search, mode: 'insensitive' as Prisma.QueryMode } },
                    { walletAddr: { contains: search, mode: 'insensitive' as Prisma.QueryMode } }
                ];
            }
            if (startDate || endDate) {
                whereClause.createdAt = {};
                if (startDate) whereClause.createdAt.gte = new Date(startDate);
                if (endDate) {
                    const endDateTime = new Date(endDate);
                    endDateTime.setHours(23, 59, 59, 999);
                    whereClause.createdAt.lte = endDateTime;
                }
            }

            const validSortFields = ['createdAt', 'amount', 'status', 'updatedAt'];
            const sortField = validSortFields.includes(sortBy) ? sortBy : 'createdAt';
            const orderBy: Prisma.OrderOrderByWithRelationInput = { [sortField]: sortOrder === 'asc' ? 'asc' : 'desc' };

            const [orders, totalCount] = await this.orderRepo.findUserOrders(whereClause, orderBy, skip, limit);
            
            return {
                success: true,
                data: {
                    orders,
                    pagination: { total: totalCount, page, limit, totalPages: Math.ceil(totalCount / limit) }
                }
            };
        } catch (err: any) {
            return { success: false, error: err.message };
        }
    }

    async deleteOrder(orderId: string, userId: string) {
        try {
            const order = await this.orderRepo.findByIdAndUser(orderId, userId);
            if (!order) return { success: false, error: "Order not found" };
            if (order.status === 'COMPLETED' || order.status === 'PROCESSING') {
                return { success: false, error: "Cannot delete a completed or processing order" };
            }
            await this.orderRepo.delete(orderId);
            return { success: true, message: "Order deleted successfully" };
        } catch (err: any) {
            return { success: false, error: err.message };
        }
    }

    async updateOrderUTR(orderId: string, utrNumber: string, userId: string) {
        try {
            const order = await this.orderRepo.findByIdAndUser(orderId, userId);
            if (!order) return { success: false, error: "Order not found" };
            if (order.status !== "PENDING") return { success: false, error: "Order is not pending" };

            const updatedOrder = await this.orderRepo.updateUtr(orderId, utrNumber);
            
            // Auto-trigger verify
            this.verifyUTRAndCompleteOrder(utrNumber).catch(err => {
                console.error('Auto-payout failed for UTR', utrNumber, err);
            });

            return { success: true, data: updatedOrder };
        } catch (err: any) {
            return { success: false, error: err.message };
        }
    }

    async verifyUTRAndCompleteOrder(utrNumber: string) {
        try {
            const order = await this.orderRepo.findByUtr(utrNumber);
            if (!order) return { success: false, error: 'Order with given UTR not found' };
            if (order.status !== 'PENDING' && order.status !== 'AWAITING_PAYMENT') return { success: false, error: 'Order not in payable state' };

            const emailTx = await this.emailRepo.findByRrn(utrNumber);
            if (!emailTx) return { success: false, error: 'Payment not received yet' };
            if (emailTx.isUsed) return { success: false, error: 'UTR already used' };

            if (emailTx.amount < (order.amount - 1)) {
                return { success: false, error: 'Payment amount is less than order amount' };
            }

            await this.emailRepo.markAsUsed(emailTx.id);

            const claimed = await this.orderRepo.claimOrderForProcessing(order.id, ['PENDING', 'AWAITING_PAYMENT']);
            if (!claimed) return { success: false, error: 'Order already processing or completed' };

            const calc = await this.solanaFacade.calculateUSDCAmount(Number(order.amount));
            if (!calc.success || !calc.usdcAmount) {
                await this.orderRepo.updateStatus({ id: order.id }, 'PENDING');
                return { success: false, error: 'Failed to calculate USDC amount' };
            }

            const transferResult = await this.solanaFacade.transferUSDC(order.walletAddr, calc.usdcAmount);
            if (!transferResult.success) {
                await this.orderRepo.updateStatus({ id: order.id }, 'PENDING');
                return { success: false, error: transferResult.error || 'Transfer failed' };
            }

            const updated = await this.orderRepo.updateCompleted(
                order.id, 
                transferResult.signature!, 
                transferResult.recipientTokenAccount! || ""
            );
            return { success: true, data: updated };
        } catch (err: any) {
            await this.orderRepo.updateStatus({ utrNumber, status: 'PROCESSING' }, 'PENDING');
            return { success: false, error: err.message };
        }
    }
}