import { FiatDepositEvent } from '../events/EmailWatcherEventBus';

/**
 * IEmailParser — Abstract Factory Interface
 * ──────────────────────────────────────────
 * OOP Principles: Open/Closed, Interface Segregation, Polymorphism
 *
 * Each bank/payment provider has its own email format. Adding a new
 * bank = add a new IEmailParser class. No existing code changes.
 */
export interface IEmailParser {
    /**
     * Returns true if this parser can handle the given email.
     * Decision is based on sender address and subject line.
     */
    canParse(from: string, subject: string): boolean;

    /**
     * Extracts a FiatDepositEvent from the email body.
     * Returns null if the required fields (RRN, amount) cannot be extracted.
     */
    parse(body: string): FiatDepositEvent | null;
}
