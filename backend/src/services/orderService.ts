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

    async getOrderById(orderId: string) {
        return this.orderRepo.findById(orderId);
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
        const logPrefix = `[verifyUTR:${utrNumber}]`;
        try {
            console.log(`${logPrefix} Starting verification process...`);
            
            const order = await this.orderRepo.findByUtr(utrNumber);
            if (!order) {
                console.log(`${logPrefix} ❌ Order with given UTR not found in database.`);
                return { success: false, error: 'Order with given UTR not found' };
            }
            
            console.log(`${logPrefix} Found order ${order.id}. Current status: ${order.status}`);
            if (order.status !== 'PENDING' && order.status !== 'AWAITING_PAYMENT') {
                console.log(`${logPrefix} ℹ️ Order is already in ${order.status} state. Skipping.`);
                return { success: false, error: `Order is already ${order.status}` };
            }

            console.log(`${logPrefix} Checking for email transaction in database...`);
            const emailTx = await this.emailRepo.findByRrn(utrNumber);
            if (!emailTx) {
                console.log(`${logPrefix} ⏳ Payment not found in email transactions yet. Scraper might still be processing.`);
                return { success: false, error: 'Payment not received yet' };
            }
            
            console.log(`${logPrefix} ✅ Found email transaction ${emailTx.id}. Amount: ${emailTx.amount}, isUsed: ${emailTx.isUsed}`);
            if (emailTx.isUsed) {
                console.log(`${logPrefix} ❌ This UTR has already been marked as used.`);
                return { success: false, error: 'UTR already used' };
            }

            console.log(`${logPrefix} Validating amount... (Email: ${emailTx.amount} INR, Order: ${order.amount} INR)`);
            // Allowing 1 INR difference for rounding/buffer
            if (emailTx.amount < (order.amount - 1)) {
                console.log(`${logPrefix} ❌ Payment amount ${emailTx.amount} is less than required ${order.amount}.`);
                return { success: false, error: 'Payment amount is less than order amount' };
            }

            console.log(`${logPrefix} Attempting to claim order for processing...`);
            const claimed = await this.orderRepo.claimOrderForProcessing(order.id, ['PENDING', 'AWAITING_PAYMENT']);
            if (!claimed) {
                console.log(`${logPrefix} ⚠️ Failed to claim order. It might have been picked up by another process.`);
                return { success: false, error: 'Order already processing or completed' };
            }
            console.log(`${logPrefix} 🔒 Order locked for processing.`);

            console.log(`${logPrefix} Calculating USDC payout...`);
            const calc = await this.solanaFacade.calculateUSDCAmount(Number(order.amount));
            console.log(`${logPrefix} USDC Calculation: ${calc.usdcAmount} USDC at rate ${calc.rate}`);
            
            if (!calc.success || !calc.usdcAmount) {
                console.log(`${logPrefix} ❌ Calculation failed. Reverting order to PENDING.`);
                await this.orderRepo.updateStatus({ id: order.id }, 'PENDING');
                return { success: false, error: 'Failed to calculate USDC amount' };
            }

            console.log(`${logPrefix} 🚀 Executing Solana Transfer: ${calc.usdcAmount} USDC -> ${order.walletAddr}`);
            const startTime = Date.now();
            const transferResult = await this.solanaFacade.transferUSDC(order.walletAddr, calc.usdcAmount);
            const duration = (Date.now() - startTime) / 1000;
            
            console.log(`${logPrefix} Solana Transfer result after ${duration.toFixed(2)}s:`, transferResult);

            if (!transferResult.success) {
                console.log(`${logPrefix} ❌ Transfer failed: ${transferResult.error}. Reverting order to PENDING.`);
                await this.orderRepo.updateStatus({ id: order.id }, 'PENDING');
                return { success: false, error: transferResult.error || 'Transfer failed' };
            }

            console.log(`${logPrefix} ✅ Transfer Successful! Updating order record...`);
            const updated = await this.orderRepo.updateCompleted(
                order.id, 
                transferResult.signature!, 
                transferResult.recipientTokenAccount! || ""
            );
            
            console.log(`${logPrefix} Marking email transaction as used...`);
            await this.emailRepo.markAsUsed(emailTx.id);
            
            console.log(`${logPrefix} 🎉 Order ${order.id} fully completed and verified!`);
            return { success: true, data: updated };
        } catch (err: any) {
            console.error(`${logPrefix} 💥 UNEXPECTED ERROR:`, err);
            await this.orderRepo.updateStatus({ id: (await this.orderRepo.findByUtr(utrNumber))?.id || "", status: 'PROCESSING' }, 'PENDING');
            return { success: false, error: err.message };
        }
    }
}