import { EventEmitter } from 'events';

export interface FiatDepositEvent {
    rrn: string;
    amount: number;
    sender: string;
    date: string;
}

export class EmailWatcherEventBus extends EventEmitter {
    public static readonly FIAT_DEPOSIT_RECEIVED = 'fiat_deposit_received';

    emitFiatDeposit(data: FiatDepositEvent) {
        this.emit(EmailWatcherEventBus.FIAT_DEPOSIT_RECEIVED, data);
    }
}
