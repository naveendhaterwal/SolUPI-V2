import Imap from "imap";
import { simpleParser } from "mailparser";
import { EmailWatcherEventBus } from "../events/EmailWatcherEventBus";
import { EmailParserFactory } from "../parsers/EmailParserFactory";

/**
 * EmailWatcher — Refactored with Abstract Factory Pattern
 * ────────────────────────────────────────────────────────
 *
 * ✅ Abstract Factory — EmailParserFactory resolves the correct
 *    bank-specific parser. Adding a new bank requires ZERO changes
 *    to this class — just register a new IEmailParser.
 */
export class EmailWatcher {
    private imap: Imap;

    constructor(
        private readonly eventBus: EmailWatcherEventBus,
        private readonly parserFactory: EmailParserFactory = EmailParserFactory.createDefault(),
    ) {
        this.imap = new Imap({
            user:       process.env.EMAIL_USER as string,
            password:   process.env.EMAIL_PASS as string,
            host:       "imap.gmail.com",
            port:       993,
            tls:        true,
            tlsOptions: { rejectUnauthorized: false },
        });

        console.log(`[EmailWatcher] Registered parsers: ${parserFactory.getRegisteredParsers().join(', ')}`);
    }

    private processMessage(msg: Imap.ImapMessage) {
        msg.on("body", (stream: any) => {
            simpleParser(stream, async (err, parsed) => {
                if (err) {
                    console.error('[EmailWatcher] Error parsing email:', err);
                    return;
                }

                const from    = parsed.from?.text ?? "";
                const subject = parsed.subject ?? "";
                console.log(`[EmailWatcher] New email — From: "${from}", Subject: "${subject}"`);

                // ✅ Abstract Factory — delegates parser selection
                const parser = this.parserFactory.getParser(from, subject);
                if (!parser) {
                    console.log(`[EmailWatcher] No parser matched. Email ignored.`);
                    return;
                }

                const body  = parsed.text ?? (parsed.html as string) ?? "";
                const event = parser.parse(body);

                if (!event) {
                    console.log(`[EmailWatcher] Parser "${parser.constructor.name}" could not extract data. Email ignored.`);
                    return;
                }

                console.log(`[EmailWatcher] ✅ Parsed event via ${parser.constructor.name} — RRN: ${event.rrn}, Amount: ₹${event.amount}`);
                this.eventBus.emitFiatDeposit(event);
            });
        });
    }

    public start() {
        if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
            console.error("[EmailWatcher] EMAIL_USER or EMAIL_PASS not defined. Scraper disabled.");
            return;
        }

        console.log(`[EmailWatcher] Starting IMAP watcher for ${process.env.EMAIL_USER}...`);

        this.imap.once("ready", () => {
            console.log("[EmailWatcher] IMAP Connection ready.");
            this.imap.openBox("INBOX", false, (err, box) => {
                if (err) {
                    console.error("[EmailWatcher] Error opening INBOX:", err);
                    return;
                }
                console.log("[EmailWatcher] Watching INBOX for new mail...");

                // 1. Event-based watch (Push)
                this.imap.on("mail", () => {
                    console.log("[EmailWatcher] New mail event via push.");
                    this.fetchNewMessages(box);
                });

                // 2. Periodic poll (fallback for stability)
                setInterval(() => {
                    console.log("[EmailWatcher] Running periodic poll...");
                    this.fetchNewMessages(box);
                }, 30_000);
            });
        });

        this.imap.on("error", (err: Error) => {
            console.error("[EmailWatcher] IMAP Error:", err.message);
            if (!err.message.includes("Invalid credentials")) {
                setTimeout(() => {
                    if (this.imap.state === 'disconnected') {
                        console.log("[EmailWatcher] Attempting to reconnect...");
                        this.imap.connect();
                    }
                }, 30_000);
            }
        });

        try {
            this.imap.connect();
        } catch (error) {
            console.error("[EmailWatcher] Failed to connect:", error);
        }
    }

    private fetchNewMessages(box: Imap.Box) {
        const total = box.messages.total;
        const start = Math.max(1, total - 5);
        const fetcher = this.imap.seq.fetch(`${start}:*`, { bodies: "", struct: true });
        fetcher.on("message", this.processMessage.bind(this));
    }
}
