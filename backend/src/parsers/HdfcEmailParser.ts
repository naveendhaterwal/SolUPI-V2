import { IEmailParser } from './IEmailParser';
import { FiatDepositEvent } from '../events/EmailWatcherEventBus';

/**
 * HdfcEmailParser — Concrete Parser (Abstract Factory product)
 * ─────────────────────────────────────────────────────────────
 * Stub implementation for HDFC Bank UPI credit notifications.
 * Extend this with real regex patterns when HDFC emails are available.
 *
 * Example subject: "Money received in your HDFC Bank Account"
 */
export class HdfcEmailParser implements IEmailParser {
    canParse(from: string, subject: string): boolean {
        const f = from.toLowerCase();
        const s = subject.toLowerCase();
        return f.includes('hdfc') || s.includes('hdfc');
    }

    parse(body: string): FiatDepositEvent | null {
        // TODO: Add HDFC-specific regex patterns here
        // HDFC format: "Rs. 1,000.00 credited to your account XXXX1234"
        const rrn    = this.extractRrn(body);
        const amount = this.extractAmount(body);
        const sender = this.extractSender(body);
        const date   = this.extractDate(body);

        if (!rrn || !amount) {
            console.log('[HdfcEmailParser] Could not extract RRN or amount from HDFC email.');
            return null;
        }

        return { rrn, amount, sender: sender ?? 'Unknown', date, isUsed: false };
    }

    private extractRrn(body: string): string | null {
        // HDFC typically uses "UPI Ref No." or "Transaction ID"
        const match = body.match(/(?:UPI Ref No\.|Transaction ID)[:\s]+(\d{10,15})/i);
        return match ? match[1] : null;
    }

    private extractAmount(body: string): number | null {
        const match = body.match(/Rs\.?\s*([\d,]+(?:\.\d{2})?)\s+credited/i);
        return match ? parseFloat(match[1].replace(/,/g, '')) : null;
    }

    private extractSender(body: string): string | null {
        const match = body.match(/from\s+([A-Za-z\s]+)(?=\s+via UPI|\s+has sent)/i);
        return match ? match[1].trim() : null;
    }

    private extractDate(body: string): string {
        const match = body.match(/(?:Date|Time)[:\s]*(\d{2}[\/\-]\d{2}[\/\-]\d{4})/i);
        return match ? match[1] : new Date().toISOString();
    }
}
