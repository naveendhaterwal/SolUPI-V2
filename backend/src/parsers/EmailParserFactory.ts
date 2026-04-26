import { IEmailParser } from './IEmailParser';
import { FiatDepositEvent } from '../events/EmailWatcherEventBus';
import { SliceEmailParser } from './SliceEmailParser';
import { HdfcEmailParser } from './HdfcEmailParser';

/**
 * EmailParserFactory — Abstract Factory Pattern
 * ──────────────────────────────────────────────
 * OOP Principles: Open/Closed, Polymorphism, Dependency Inversion
 *
 * Problem solved: `EmailWatcher.processMessage()` hard-coded Slice bank
 * logic. Adding a new bank required modifying the watcher class.
 *
 * Now: adding a new bank = create a new IEmailParser class and
 * call `factory.register(new PhonePeEmailParser())`. Zero changes
 * to existing code.
 *
 * Usage:
 *   const factory = EmailParserFactory.createDefault();
 *   const parser  = factory.getParser(from, subject);
 *   if (parser) {
 *       const event = parser.parse(emailBody);
 *   }
 */
export class EmailParserFactory {
    private parsers: IEmailParser[];

    constructor(parsers: IEmailParser[] = []) {
        this.parsers = parsers;
    }

    /**
     * Creates the factory pre-registered with all supported bank parsers.
     * This is the main entry point — use this in production.
     */
    static createDefault(): EmailParserFactory {
        return new EmailParserFactory([
            new SliceEmailParser(),
            new HdfcEmailParser(),
        ]);
    }

    /**
     * Returns the first parser capable of handling the given email.
     * Returns null if no registered parser matches.
     */
    getParser(from: string, subject: string): IEmailParser | null {
        const parser = this.parsers.find(p => p.canParse(from, subject));
        if (!parser) {
            console.log(`[EmailParserFactory] No parser found for — From: "${from}", Subject: "${subject}"`);
        }
        return parser ?? null;
    }

    /**
     * Registers a new parser at runtime (e.g. PhonePe, Paytm, ICICI).
     * New parsers are tried in registration order after the defaults.
     */
    register(parser: IEmailParser): void {
        this.parsers.push(parser);
        console.log(`[EmailParserFactory] Registered new parser: ${parser.constructor.name}`);
    }

    /** Returns names of all currently registered parsers (for diagnostics). */
    getRegisteredParsers(): string[] {
        return this.parsers.map(p => p.constructor.name);
    }
}
