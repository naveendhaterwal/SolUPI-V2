import { IEmailParser } from './IEmailParser';
import { FiatDepositEvent } from '../events/EmailWatcherEventBus';

/**
 * SliceEmailParser — Concrete Parser (Abstract Factory product)
 * ──────────────────────────────────────────────────────────────
 * Parses UPI credit notification emails from Slice Bank.
 *
 * Expected email format (body fragment):
 *   "You have received ₹1,000.00 from NAVEEN KUMAR"
 *   "RRN 123456789012"
 *   "Date: 2026-04-27 01:15:00"
 */
export class SliceEmailParser implements IEmailParser {
    canParse(from: string, subject: string): boolean {
        const f = from.toLowerCase();
        const s = subject.toLowerCase();
        return f.includes('slice') || s.includes('slice');
    }

    parse(body: string): FiatDepositEvent | null {
        const rrn    = this.extractRrn(body);
        const amount = this.extractAmount(body);
        const sender = this.extractSender(body);
        const date   = this.extractDate(body);

        if (!rrn || !amount) {
            console.log('[SliceEmailParser] Could not extract RRN or amount from email body.');
            return null;
        }

        return { rrn, amount, sender: sender ?? 'Unknown', date, isUsed: false };
    }

    private extractRrn(body: string): string | null {
        const match = body.match(/RRN\s+(\d{12})/i);
        return match ? match[1] : null;
    }

    private extractAmount(body: string): number | null {
        const match = body.match(/received\s+(?:₹|Rs\.?|INR)?\s*([\d,]+(?:\.\d{2})?)/i);
        return match ? parseFloat(match[1].replace(/,/g, '')) : null;
    }

    private extractSender(body: string): string | null {
        const match = body.match(/From\s+([A-Za-z\s]+)(?=\n|\r|RRN)/i);
        return match ? match[1].trim() : null;
    }

    private extractDate(body: string): string {
        const match = body.match(/(?:Date|Sent):\s*(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})/i);
        return match ? match[1] : new Date().toISOString();
    }
}
