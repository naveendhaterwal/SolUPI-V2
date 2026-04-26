# ⚡ SolUPI — UPI to Solana On-Ramp

![Solana](https://img.shields.io/badge/Solana-Web3-black?style=for-the-badge&logo=solana)
![Next.js](https://img.shields.io/badge/Next.js-14-black?style=for-the-badge&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=for-the-badge&logo=typescript)
![Node.js](https://img.shields.io/badge/Node.js-Express-green?style=for-the-badge&logo=node.js)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Neon-blue?style=for-the-badge&logo=postgresql)
![Prisma](https://img.shields.io/badge/Prisma-ORM-white?style=for-the-badge&logo=prisma)

> Bridge the gap between Fiat and Crypto with the speed of Solana and the convenience of UPI.

---

## Live Demo

| Component | URL |
|-----------|-----|
| **Frontend** | https://sol-upi-v2.vercel.app |
| **Backend** | https://solupi-backend.onrender.com |

---

## Project Overview

### The Problem
In the current crypto ecosystem, converting Fiat to Crypto (on-ramping) is a complex, slow, and expensive process. Users are forced to navigate:
- **P2P Exchanges:** High risk of scams and slow settlement times.
- **Centralized Exchanges:** High fees, strict KYC requirements, and custodial risks.
- **Lack of Direct Access:** No seamless way to use UPI — India's primary payment rail — to buy crypto directly.

### The Solution
SolUPI is a decentralized application that allows users to purchase USDC directly using UPI, leveraging the speed and low cost of the Solana blockchain. Payment verification is fully automated via bank email receipt parsing — no manual intervention required.

**Key Features:**
- Direct UPI payment with instant QR code
- Automated settlement via IMAP email monitoring and UTR/RRN matching
- Non-custodial — funds go directly to the user's Solana wallet
- Transparent on-chain transaction tracking via Solana Explorer

---

## Architecture & Design Patterns

The SolUPI backend has been built to enterprise standards. Every major business concern is encapsulated in a formal software design pattern. The codebase implements **13 distinct OOP design patterns** across the Gang of Four (GoF) and Enterprise categories.

### Creational Patterns

| Pattern | File | Purpose |
|---|---|---|
| **Singleton** | `config/AppConfig.ts` | Single validated source of truth for all `process.env.*` variables. Eliminates scattered, unvalidated reads across 6+ files. |
| **Abstract Factory** | `parsers/EmailParserFactory.ts` | Dynamically selects the correct bank-specific email parser (`SliceEmailParser`, `HdfcEmailParser`) based on the sender address. Adding a new bank requires zero changes to any existing class. |

### Structural Patterns

| Pattern | File | Purpose |
|---|---|---|
| **Facade** | `facades/SolanaFacade.ts` | Hides the complexity of Solana Web3.js (ATA creation, SPL token transfers, compute budget, retry logic) behind a single clean interface. |
| **Decorator** | `strategies/decorators/CachedPricingStrategy.ts` | Wraps `IPricingStrategy` to add a 60-second in-memory cache, preventing excessive hits to the exchange rate API. |
| **Decorator** | `strategies/decorators/LoggedPricingStrategy.ts` | Wraps `IPricingStrategy` to add structured timing and error logs without modifying pricing logic. |
| **Repository** | `repositories/OrderRepository.ts` | Encapsulates all Prisma/database queries for Orders, decoupling the service layer from the ORM. |
| **Repository** | `repositories/EmailTransactionRepository.ts` | Encapsulates all Prisma/database queries for EmailTransactions, including atomic `isUsed` flag updates. |

### Behavioral Patterns

| Pattern | File | Purpose |
|---|---|---|
| **Strategy** | `strategies/IPricingStrategy.ts` | Defines a swappable interface for USDC pricing. The concrete implementation (`ExchangeRateApiStrategy`) can be replaced (e.g., with a Chainlink oracle) without touching any business logic. |
| **State Machine** | `states/OrderStateMachine.ts` | Enforces strict, validated order lifecycle transitions. Prevents illegal jumps like `COMPLETED → PENDING`. Comprises 6 concrete states: `Pending`, `AwaitingPayment`, `Processing`, `Completed`, `Failed`, `Cancelled`. |
| **Chain of Responsibility** | `handlers/VerificationHandlers.ts` | Replaces a 189-line god-method with an 8-step sequential verification pipeline. Each handler (`OrderExistsHandler` → `OrderStatusHandler` → `EmailTransactionHandler` → `AmountValidationHandler` → `OrderClaimHandler` → `USDCCalculationHandler` → `SolanaTransferHandler` → `OrderCompletionHandler`) has one job and can be tested in isolation. |
| **Command** | `commands/OrderCommands.ts` | Encapsulates all order mutations (`CreateOrderCommand`, `UpdateOrderUTRCommand`, `DeleteOrderCommand`) as first-class objects. Each command is independently loggable, retryable, and auditable. |
| **Command Bus** | `commands/OrderCommands.ts` (`CommandBus`) | Central dispatcher that executes commands and maintains an in-memory audit log with timestamps and duration for every mutation. |
| **Observer / Event Bus** | `events/EmailWatcherEventBus.ts` | Extends Node.js `EventEmitter` to decouple the `EmailWatcher` (event producer) from `OrderService` (event consumer). The watcher emits `fiat_deposit_received`; the service subscribes and triggers verification. |
| **Template Method** | `handlers/IVerificationHandler.ts` (`BaseVerificationHandler`) | Abstract base class that defines the algorithm skeleton (`handle()` → short-circuit on error → `process()`). Concrete handlers only implement `process()`, with chain-linking mechanics inherited. |

### Enterprise / Data Patterns

| Pattern | File | Purpose |
|---|---|---|
| **Unit of Work** | `uow/PayoutUnitOfWork.ts` | Wraps the two critical DB writes — `updateCompleted()` and `markUsed()` — in a single Prisma transaction. Eliminates the double-spend vulnerability that existed when these were separate calls. |
| **Builder** | `builders/OrderQueryBuilder.ts` | Fluent query construction for `getUserOrders()`. Replaces a 50-line chain of `if/else` blocks with a composable, readable API: `.forUser().withStatus().withDateRange().build()`. |

---

## Interactive Architecture Diagrams

The `/diagrams` directory contains three self-contained, interactive HTML documents. Open each directly in a browser — no server required.

| File | Description |
|---|---|
| `animated_sequence.html` | 7-step animated sequence diagram of the full order lifecycle, from user input to on-chain USDC delivery. Each step includes plain-English and technical labels. |
| `solupi_er_diagram.html` | 4-step interactive Entity-Relationship diagram of the Prisma schema. Covers `User`, `Order`, and `EmailTransaction` tables and their logical relationship. |
| `solupi_uml_class_diagram_v2.html` | Full UML class diagram showing all pattern implementations, class attributes, method signatures, and inter-class relationships across all 8 architectural layers. |

---

## Tech Stack

### Frontend
| | |
|---|---|
| **Framework** | [Next.js 14](https://nextjs.org/) — App Router |
| **Styling** | [Tailwind CSS](https://tailwindcss.com/) |
| **Animations** | [Framer Motion](https://www.framer.com/motion/) |
| **Icons** | [Lucide React](https://lucide.dev/) |

### Backend
| | |
|---|---|
| **Runtime** | [Node.js](https://nodejs.org/) |
| **Framework** | [Express.js](https://expressjs.com/) |
| **Database** | [PostgreSQL](https://www.postgresql.org/) via [Neon](https://neon.tech/) |
| **ORM** | [Prisma](https://www.prisma.io/) |
| **Blockchain** | [Solana Web3.js](https://solana-labs.github.io/solana-web3.js/) + [SPL Token](https://spl.solana.com/) |
| **Email** | IMAP + [Mailparser](https://nodemailer.com/extras/mailparser/) |

---

## Database Schema

Three core tables managed via Prisma:

- **`User`** — Identity, contact details, and default Solana wallet address.
- **`Order`** — Records each conversion request with INR amount, USDC target wallet, UTR reference, and on-chain transaction signature.
- **`EmailTransaction`** — Stores parsed bank email data. The `rrn` field (Bank RRN/UTR) is matched against the `Order.utrNumber` field to trigger the verification chain. The `isUsed` flag prevents double-spend.

---

## Getting Started

### Prerequisites
- Node.js v18+
- npm or yarn
- A PostgreSQL database URL (Neon recommended)

### Installation

**1. Clone the repository**
```bash
git clone https://github.com/naveenkumar29052006/SolUPI-V2.git
cd SolUPI-V2
```

**2. Install dependencies**
```bash
# Backend
cd backend && npm install

# Frontend
cd ../frontend && npm install
```

**3. Configure environment variables**

Create `backend/.env`:
```env
DATABASE_URL="postgresql://..."
PORT=3001
EMAIL_USER="your-gmail@gmail.com"
EMAIL_PASS="your-gmail-app-password"
SOLANA_RPC_URL="https://api.devnet.solana.com"
SOLANA_PRIVATE_KEY="your-base58-private-key"
USDC_MINT_ADDRESS="4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"
JWT_SECRET="your-secret"
```

**4. Push the database schema**
```bash
cd backend
npx prisma generate
npx prisma db push
```

**5. Start the application**
```bash
# Terminal 1 — Backend
cd backend && npm run dev

# Terminal 2 — Frontend
cd frontend && npm run dev
```

---

## API Reference

### User Management

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/users/:id` | Fetch user profile |
| `PUT` | `/api/users/:id` | Update profile (name, mobile, etc.) |
| `DELETE` | `/api/users/:id` | Delete account |

### Order Management

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/orders` | Create a new buy order |
| `GET` | `/api/orders` | List orders with pagination (`?page=1&limit=5`) |
| `PUT` | `/api/orders/:id/utr` | Submit UTR for verification |
| `DELETE` | `/api/orders/:id` | Cancel a pending order |

---

## Roadmap

- [ ] KYC integration for identity verification
- [ ] Multi-chain support (Ethereum, Polygon)
- [ ] P2P marketplace for crypto-to-fiat
- [ ] Native mobile application (iOS & Android)

---

## License

MIT License
