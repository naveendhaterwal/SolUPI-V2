import { Request, Response } from 'express';
import { OrderService } from '../services/orderService';

export class OrderController {
    constructor(private orderService: OrderService) {}

    createOrder = async (req: Request, res: Response) => {
        try {
            const { userId, amount, walletAddress } = req.body;
            if (!userId || !amount || !walletAddress || isNaN(amount) || amount <= 0) {
                return res.status(400).json({ success: false, message: "Invalid request parameters" });
            }
            const result = await this.orderService.createOrder(userId, amount, walletAddress);
            if (result.success) {
                return res.status(201).json({ success: true, message: "Order created successfully", data: result.data });
            } else {
                return res.status(400).json({ success: false, message: "Failed: " + result.error });
            }
        } catch (err: any) {
            return res.status(500).json({ success: false, message: "Server error", error: err.message });
        }
    }

    getUserOrders = async (req: Request, res: Response) => {
        try {
            const { userId, page, limit, status, search, startDate, endDate, sortBy, sortOrder } = req.query;
            if (!userId) return res.status(400).json({ success: false, message: "Missing userId" });
            
            const result = await this.orderService.getUserOrders(
                userId as string, parseInt(page as string) || 1, parseInt(limit as string) || 10,
                status as string, search as string, startDate as string, endDate as string,
                sortBy as string, sortOrder as string
            );
            
            if (result.success) return res.status(200).json({ success: true, data: result.data });
            return res.status(400).json({ success: false, message: result.error });
        } catch (err: any) {
            return res.status(500).json({ success: false, message: "Server error", error: err.message });
        }
    }

    getOrder = async (req: Request, res: Response) => {
        try {
            const { orderId } = req.params;
            if (!orderId) return res.status(400).json({ success: false, message: "Missing orderId" });
            
            const order = await this.orderService.getOrderById(orderId);
            if (!order) return res.status(404).json({ success: false, message: "Order not found" });

            // Lazy verification: if order has UTR but is still PENDING, try to verify it
            if (order.status === 'PENDING' && order.utrNumber) {
                console.log(`[OrderController] Polling detected PENDING order ${order.id} with UTR ${order.utrNumber}. Triggering lazy verification...`);
                this.orderService.verifyUTRAndCompleteOrder(order.utrNumber).catch(err => {
                    console.error(`[OrderController] Lazy verification failed for ${order.id}:`, err);
                });
            }

            return res.status(200).json({ success: true, data: order });
        } catch (err: any) {
            console.error(`[OrderController] Error in getOrder:`, err);
            return res.status(500).json({ success: false, message: "Server error", error: err.message });
        }
    }

    updateOrderUTR = async (req: Request, res: Response) => {
        try {
            const { orderId } = req.params;
            const { utrNumber, userId } = req.body;
            console.log(`[OrderController] Received PUT /orders/${orderId}/utr - UTR: ${utrNumber}, User: ${userId}`);
            
            if (!orderId || !utrNumber || !userId) {
                console.log(`[OrderController] Missing fields in payload`);
                return res.status(400).json({ success: false, message: "Missing fields" });
            }
            
            const result = await this.orderService.updateOrderUTR(orderId, utrNumber, userId);
            console.log(`[OrderController] updateOrderUTR result:`, result);
            
            if (result.success) return res.status(200).json({ success: true, data: result.data });
            return res.status(400).json({ success: false, message: result.error });
        } catch (err: any) {
            return res.status(500).json({ success: false, message: "Server error", error: err.message });
        }
    }

    deleteOrder = async (req: Request, res: Response) => {
        try {
            const { orderId } = req.params;
            const { userId } = req.body;
            if (!orderId || !userId) return res.status(400).json({ success: false, message: "Missing fields" });
            
            const result = await this.orderService.deleteOrder(orderId, userId);
            if (result.success) return res.status(200).json({ success: true, message: result.message });
            return res.status(400).json({ success: false, message: result.error });
        } catch (err: any) {
            return res.status(500).json({ success: false, message: "Server error", error: err.message });
        }
    }
}
