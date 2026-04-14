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
        if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) return;

        this.imap.once("ready", () => {
            this.imap.openBox("INBOX", false, (err, box) => {
                if (err) return;
                this.imap.on("mail", () => {
                    const fetcher = this.imap.seq.fetch(box.messages.total + ":*", { bodies: "", struct: true });
                    fetcher.on("message", this.processMessage.bind(this));
                });
            });
        });

        this.imap.once("error", () => {
            setTimeout(() => this.imap.connect(), 5000);
        });

        this.imap.connect();
    }
}
