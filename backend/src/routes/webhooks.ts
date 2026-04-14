import express from 'express';
// import { processEmailWebhook } from '../services/emailVerificationService';

const router = express.Router();

// Endpoint to parse raw email content and trigger verification
router.post('/email-parse', async (req, res) => {
    try {
        const { emailBody } = req.body;

        if (!emailBody) {
            return res.status(400).json({
                success: false,
                message: "Missing 'emailBody' in request body"
            });
        }

        // const result = await processEmailWebhook(emailBody);

        // if (result.success) {
        //     return res.status(200).json(result);
        // } else {
        //     return res.status(400).json(result);
        // }
        return res.status(200).json({ success: false, message: "Webhook not implemented yet" });

    } catch (err: any) {
        console.error("Error in email webhook:", err);
        return res.status(500).json({
            success: false,
            message: "Internal server error during verification",
            error: err.message
        });
    }
});

export default router;
