import Imap from "imap";
import { simpleParser } from "mailparser";
import { EmailWatcherEventBus } from "../events/EmailWatcherEventBus";

export class EmailWatcher {
    private imap: Imap;

    constructor(private eventBus: EmailWatcherEventBus) {
        this.imap = new Imap({
            user: process.env.EMAIL_USER as string,
            password: process.env.EMAIL_PASS as string,
            host: "imap.gmail.com",
            port: 993,
            tls: true,
            tlsOptions: { rejectUnauthorized: false }
        });
    }

    private extractData(emailBody: string) {
        const result = { rrn: null as string|null, amount: null as number|null, sender: null as string|null, date: new Date().toISOString(), isUsed: false };
        
        const rrnMatch = emailBody.match(/RRN\s+(\d{12})/i);
        if (rrnMatch) result.rrn = rrnMatch[1];
        
        const amMatch = emailBody.match(/received\s+(?:₹|Rs\.?|INR)?\s*([\d,]+(?:\.\d{2})?)/i);
        if (amMatch) result.amount = parseFloat(amMatch[1].replace(/,/g, ''));
        
        const senderMatch = emailBody.match(/From\s+([A-Za-z\s]+)(?=\n|\r|RRN)/i);
        if (senderMatch) result.sender = senderMatch[1].trim();
        
        const dMatch = emailBody.match(/(?:Date|Sent):\s*(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})/i);
        if (dMatch) result.date = dMatch[1];
        
        return result;
    }

    private processMessage(msg: Imap.ImapMessage) {
        msg.on("body", (stream: any) => {
            simpleParser(stream, async (err, parsed) => {
                if (err) return;
                const from = parsed.from?.text || "";
                const subject = parsed.subject || "";
                
                console.log(`[EmailWatcher] New email received. From: "${from}", Subject: "${subject}"`);
                
                if (!from.toLowerCase().includes("slice") && !subject.toLowerCase().includes("slice")) {
                    console.log(`[EmailWatcher] Ignored email: does not contain "slice" in From or Subject.`);
                    return;
                }
                
                const data = this.extractData(parsed.text || parsed.html as string);
                console.log(`[EmailWatcher] Extracted data from slice email:`, data);
                
                if (data.rrn && data.amount && data.sender) {
                    console.log(`[EmailWatcher] Emitting FiatDepositEvent for RRN: ${data.rrn}`);
                    this.eventBus.emitFiatDeposit({ rrn: data.rrn, amount: data.amount, sender: data.sender, date: data.date, isUsed: data.isUsed });
                } else {
                    console.log(`[EmailWatcher] Could not extract necessary RRN/Amount from email body.`);
                }
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
                    console.log("[EmailWatcher] New mail event detected via push.");
                    this.fetchNewMessages(box);
                });

                // 2. Periodic poll (Fallback for stability)
                setInterval(() => {
                    console.log("[EmailWatcher] Running periodic poll...");
                    this.fetchNewMessages(box);
                }, 30000); // Every 30 seconds
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
                }, 30000);
            }
        });

        try {
            this.imap.connect();
        } catch (error) {
            console.error("[EmailWatcher] Failed to connect:", error);
        }
    }

    private fetchNewMessages(box: Imap.Box) {
        // Fetch only the most recent messages to check for deposits
        const total = box.messages.total;
        const start = Math.max(1, total - 5); // Fetch last 5 messages to be safe
        const fetcher = this.imap.seq.fetch(`${start}:*`, { bodies: "", struct: true });
        fetcher.on("message", this.processMessage.bind(this));
    }
}
