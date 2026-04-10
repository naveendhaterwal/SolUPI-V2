import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';

import { prisma } from './services/prisma';
import { OrderRepository } from './repositories/OrderRepository';
import { EmailTransactionRepository } from './repositories/EmailTransactionRepository';
import { ExchangeRateApiStrategy } from './strategies/ExchangeRateApiStrategy';
import { SolanaFacade } from './facades/SolanaFacade';
import { OrderService } from './services/orderService';
import { EmailVerificationService } from './services/emailVerificationService';
import { EmailWatcherEventBus } from './events/EmailWatcherEventBus';
import { EmailWatcher } from './services/emailWatcher';
import { OrderController } from './controllers/OrderController';

import authRoutes from './routes/auth';
import webhookRoutes from './routes/webhooks';
import userRoutes from './routes/users';
import priceRoutes from './routes/prices';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: 'http://localhost:3000', credentials: true }));
app.use(express.json());
app.use(cookieParser());

// 1. Dependency Injection & Composition
const orderRepo = new OrderRepository(prisma);
const emailTxRepo = new EmailTransactionRepository(prisma);

const pricingStrategy = new ExchangeRateApiStrategy();
const solanaFacade = new SolanaFacade(pricingStrategy);

const orderService = new OrderService(orderRepo, solanaFacade, emailTxRepo);
const emailVerificationService = new EmailVerificationService(emailTxRepo, orderService);

const eventBus = new EmailWatcherEventBus();
const emailWatcher = new EmailWatcher(eventBus);

// 2. Attach Observers (Decoupled event handling)
eventBus.on(EmailWatcherEventBus.FIAT_DEPOSIT_RECEIVED, (data) => {
    emailVerificationService.handleNewFiatDeposit(data);
});

// 3. Controllers setup
const orderController = new OrderController(orderService);
const router = express.Router();
router.post('/orders', (req, res) => orderController.createOrder(req, res));
router.get('/orders', (req, res) => orderController.getUserOrders(req, res));
router.put('/orders/:orderId/utr', (req, res) => orderController.updateOrderUTR(req, res));
router.delete('/orders/:orderId', (req, res) => orderController.deleteOrder(req, res));

app.use('/api', router);
app.use('/api/auth', authRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/users', userRoutes);
app.use('/api/prices', priceRoutes);

app.get('/', (req, res) => {
    res.send('SolUPI Backend is running with SOLID Architecture');
});

// 4. Start Server
app.listen(PORT, () => {
    console.log(`🚀 SolUPI Server running cleanly on port ${PORT}`);
    emailWatcher.start();
});
