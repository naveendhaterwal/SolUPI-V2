import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';

// ── Load env FIRST, before AppConfig singleton is created ──
dotenv.config();

// ── Pattern 1: Singleton — AppConfig validates all env vars at startup ──
import { AppConfig } from './config/AppConfig';
const config = AppConfig.getInstance();

import { prisma } from './services/prisma';
import { OrderRepository } from './repositories/OrderRepository';
import { EmailTransactionRepository } from './repositories/EmailTransactionRepository';

// ── Pattern 6: Decorator — Compose pricing strategy stack ──────────────
import { ExchangeRateApiStrategy } from './strategies/ExchangeRateApiStrategy';
import { CachedPricingStrategy } from './strategies/decorators/CachedPricingStrategy';
import { LoggedPricingStrategy } from './strategies/decorators/LoggedPricingStrategy';

import { SolanaFacade } from './facades/SolanaFacade';

// ── Pattern 2: Unit of Work ────────────────────────────────────────────
import { PayoutUnitOfWork } from './uow/PayoutUnitOfWork';
import { OrderService } from './services/orderService';
import { EmailVerificationService } from './services/emailVerificationService';
import { EmailWatcherEventBus } from './events/EmailWatcherEventBus';
import { EmailWatcher } from './services/emailWatcher';

// ── Pattern 5: Abstract Factory — pre-built parser factory ────────────
import { EmailParserFactory } from './parsers/EmailParserFactory';

import { OrderController } from './controllers/OrderController';

import authRoutes from './routes/auth';
import webhookRoutes from './routes/webhooks';
import userRoutes from './routes/users';
import priceRoutes from './routes/prices';

const app = express();

app.use(cors({ origin: config.frontendOrigin, credentials: true }));
app.use(express.json());
app.use(cookieParser());

// ─────────────────────────────────────────────────────────────────────────
// Dependency Injection & Composition Root
// (All patterns are wired here — only one place to change)
// ─────────────────────────────────────────────────────────────────────────

// Repositories
const orderRepo   = new OrderRepository(prisma);
const emailTxRepo = new EmailTransactionRepository(prisma);

// ✅ Decorator Stack: ExchangeRateApi → CachedPricing (60s TTL) → LoggedPricing
const rawPricingStrategy    = new ExchangeRateApiStrategy();
const cachedPricingStrategy = new CachedPricingStrategy(rawPricingStrategy, 60_000);
const pricingStrategy       = new LoggedPricingStrategy(cachedPricingStrategy);

// Facade (uses the decorated strategy)
const solanaFacade = new SolanaFacade(pricingStrategy);

// ✅ Unit of Work — atomic double-spend protection
const payoutUoW = new PayoutUnitOfWork(prisma);

// ✅ OrderService — uses Builder, State, UoW, Chain, Command internally
const orderService = new OrderService(orderRepo, solanaFacade, emailTxRepo, payoutUoW);

// Email verification service
const emailVerificationService = new EmailVerificationService(emailTxRepo, orderService);

// ✅ Abstract Factory — EmailParserFactory with all registered bank parsers
const parserFactory = EmailParserFactory.createDefault();

// Observer pattern (existing) + Abstract Factory (new)
const eventBus    = new EmailWatcherEventBus();
const emailWatcher = new EmailWatcher(eventBus, parserFactory);

// Attach event observers — decoupled from EmailWatcher
eventBus.on(EmailWatcherEventBus.FIAT_DEPOSIT_RECEIVED, (data) => {
    emailVerificationService.handleNewFiatDeposit(data);
});

// Controller
const orderController = new OrderController(orderService);

// ─────────────────────────────────────────────────────────────────────────
// Routes
// ─────────────────────────────────────────────────────────────────────────
const router = express.Router();
router.post('/orders',               (req, res) => orderController.createOrder(req, res));
router.get('/orders',                (req, res) => orderController.getUserOrders(req, res));
router.get('/orders/:orderId',       (req, res) => orderController.getOrder(req, res));
router.put('/orders/:orderId/utr',   (req, res) => orderController.updateOrderUTR(req, res));
router.delete('/orders/:orderId',    (req, res) => orderController.deleteOrder(req, res));

// Diagnostics — audit log endpoint (dev/admin use)
router.get('/audit-log', (req, res) => {
    res.json({ success: true, data: orderService.getCommandAuditLog(50) });
});

app.use('/api', router);
app.use('/api/auth',     authRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/users',    userRoutes);
app.use('/api/prices',   priceRoutes);

app.get('/', (_req, res) => {
    res.send('SolUPI Backend — 8 OOP Design Patterns Active ✅');
});

// ─────────────────────────────────────────────────────────────────────────
// Start Server
// ─────────────────────────────────────────────────────────────────────────
app.listen(config.port, '0.0.0.0', () => {
    console.log(`\n🚀 SolUPI Server running on port ${config.port}`);
    console.log(`   Network : ${config.solanaNetwork}`);
    console.log(`   Parsers : ${parserFactory.getRegisteredParsers().join(', ')}`);
    console.log(`   Patterns: Singleton ✅ UoW ✅ Builder ✅ State ✅ Factory ✅ Decorator ✅ Chain ✅ Command ✅\n`);
    emailWatcher.start();
});
