import { EmailTransactionRepository } from '../repositories/EmailTransactionRepository';
import { OrderService } from './orderService';
import { FiatDepositEvent } from '../events/EmailWatcherEventBus';

export class EmailVerificationService {
    constructor(
        private emailRepo: EmailTransactionRepository,
        private orderService: OrderService
    ) {}

    async handleNewFiatDeposit(data: FiatDepositEvent) {
        try {
            console.log(`[Email Verification] Handling deposit: RRN ${data.rrn}, Amount ${data.amount}`);
            
            const transaction = await this.emailRepo.create({
                rrn: data.rrn,
                sender: data.sender || "Unknown",
                transactionDate: data.date,
                amount: data.amount,
                isUsed: false
            });

            console.log(`[Email Verification] Stored transaction: ${transaction.id}, triggering order service`);
            
            this.orderService.verifyUTRAndCompleteOrder(data.rrn).catch(err => {
                console.error(`[Email Verification] Auto-verification failed for RRN ${data.rrn}:`, err);
            });

        } catch (error: any) {
             console.error(`[Email Verification] Error processing deposit:`, error.message);
        }
    }
}
