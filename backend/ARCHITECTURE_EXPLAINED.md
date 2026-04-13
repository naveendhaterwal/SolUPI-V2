# SolUPI Architecture: SOLID & Design Patterns

This document provides a deep dive into the architectural principles and design patterns implemented in the SolUPI project. It includes specific file references, real code examples, and potential "Viva" or defense questions your professors/interviewers might ask.

---

## 1. SOLID Principles

### **S - Single Responsibility Principle (SRP)**
*   **Principle:** A class should have only one reason to change (i.e., do one thing).
*   **Files Involved:** `src/services/OrderService.ts`, `src/facades/SolanaFacade.ts`, `src/repositories/OrderRepository.ts`
*   **Real Example in Code:** 
    Previously, a single massive script handled HTTP requests, database saving, and Solana transactions. Now, we split them. Data access goes to `OrderRepository`, Solana transactions to `SolanaFacade`, and core business flow sits in `OrderService`.
    ```typescript
    // OrderService no longer does Solana stuff itself; it delegates.
    const transferResult = await this.solanaFacade.transferUSDC(order.walletAddr, calc.usdcAmount);
    ```
*   **👨‍🏫 Teacher/Cross Question:** *If we decide to change the database from PostgreSQL to MongoDB, which classes will need to be rewritten?*
    *   **Answer:** Only the Repository classes (e.g., `OrderRepository`). The `OrderService` and `Controllers` will remain perfectly untouched because they don't know *how* data is saved, just that it is saved.

### **O - Open/Closed Principle (OCP)**
*   **Principle:** Software entities should be open for extension but closed for modification.
*   **Files Involved:** `src/strategies/IPricingStrategy.ts`, `src/strategies/ExchangeRateApiStrategy.ts`
*   **Real Example in Code:**
    We created an interface for getting USDC prices.
    ```typescript
    export interface IPricingStrategy {
        getLiveUSDCPrice(): Promise<PricingResult>;
    }
    ```
*   **👨‍🏫 Teacher/Cross Question:** *If the ExchangeRateAPI goes down, and we need to immediately switch to CoinGecko, how much existing code do we have to modify?*
    *   **Answer:** Zero existing logic needs modification. We just create a new file `CoinGeckoStrategy.ts` that `implements IPricingStrategy`, and pass that into the system at startup. The `SolanaFacade` continues working unaware of the underlying change.

### **D - Dependency Inversion Principle (DIP)**
*   **Principle:** Depend upon abstractions, not concretions. High-level modules should not instantiate low-level modules using `new`.
*   **Files Involved:** `src/services/OrderService.ts`, `src/server.ts`
*   **Real Example in Code:**
    Instead of `OrderService` creating its own repository (`this.repo = new OrderRepository()`), we pass it through the constructor.
    ```typescript
    export class OrderService {
        constructor(
            private orderRepo: OrderRepository,
            private solanaFacade: SolanaFacade
        ) {}
    }
    ```
*   **👨‍🏫 Teacher/Cross Question:** *How do you write Unit Tests for `OrderService` without actually modifying the real production database during tests?*
    *   **Answer:** Because we use Dependency Injection via the constructor, in our test files we can pass a dummy `MockOrderRepository` into the `OrderService`. The service won't know the difference, and our real DB stays safe.

---

## 2. Design Patterns

### **Repository Pattern**
*   **What it does:** Abstracts away the database layer (Prisma/SQL) into a cleaner API for the application.
*   **Files Involved:** `src/repositories/OrderRepository.ts`
*   **Real Example in Code:**
    ```typescript
    export class OrderRepository {
        async findByUtr(utrNumber: string) {
            return this.prisma.order.findFirst({ where: { utrNumber } });
        }
    }
    ```
*   **👨‍🏫 Teacher/Cross Question:** *Prisma is already an ORM, so isn't a Repository Pattern redundant?*
    *   **Answer:** While Prisma is an ORM, scattering `prisma.order.findMany` throughout our Controllers and Services tightly couples our app to Prisma specifically. Wrapping it in a Repository allows us to centralize complex queries and makes it vastly easier to mock data during testing.

### **Facade Pattern**
*   **What it does:** Provides a simplified, high-level interface to a complex subsystem.
*   **Files Involved:** `src/facades/SolanaFacade.ts`
*   **Real Example in Code:**
    The `@solana/web3.js` library requires manually loading Keypairs, RPC Connections, and deriving Associated Token Accounts. Our Facade hides these 50+ lines of complex logic behind a single, simple method:
    ```typescript
    // Inside the Controller/Service, we only care about this one line:
    await this.solanaFacade.transferUSDC("WalletAddressXYZ", 50.00);
    ```
*   **👨‍🏫 Teacher/Cross Question:** *Why use a Facade instead of just utility functions?*
    *   **Answer:** A Facade maintains state (like the initialized RPC connection and the loaded Keypair) across the lifecycle of the app without relying on global variables. It groups the entire subsystem (Solana interactions) under one cohesive, injectable object.

### **Strategy Pattern**
*   **What it does:** Defines a family of algorithms, encapsulates each one, and makes them interchangeable dynamically.
*   **Files Involved:** `src/strategies/ExchangeRateApiStrategy.ts`
*   **Real Example in Code:**
    ```typescript
    // It encapsulates the specific axios call and markup calculations.
    export class ExchangeRateApiStrategy implements IPricingStrategy {
        async getLiveUSDCPrice() { /* Calls external API */ }
    }
    ```
*   **👨‍🏫 Teacher/Cross Question:** *How is the Strategy pattern different from the State pattern?*
    *   **Answer:** While both involve interchangeable objects, the Strategy pattern is about changing the *algorithm* or *how* something is done (e.g., getting price from API A vs API B). The State pattern is used when an object changes its behavior completely based on its internal state (like an Order transitioning from PENDING to COMPLETED).

### **Observer Pattern (Event-Driven)**
*   **What it does:** Lets objects subscribe to events without the source needing to know who is listening.
*   **Files Involved:** `src/events/EmailWatcherEventBus.ts`, `src/services/emailWatcher.ts`
*   **Real Example in Code:**
    When an email arrives, the watcher doesn't call `OrderService`. It just shouts into the void via the `EventEmitter`.
    ```typescript
    // The Watcher simply emits an event
    this.eventBus.emitFiatDeposit({ rrn, amount, sender });
    
    // Somewhere else in server.ts, someone is listening
    eventBus.on(EmailWatcherEventBus.FIAT_DEPOSIT_RECEIVED, (data) => {
        emailVerificationService.handleNewFiatDeposit(data);
    });
    ```
*   **👨‍🏫 Teacher/Cross Question:** *Why did you decouple the `EmailWatcher` from the `OrderService`? Couldn't `EmailWatcher` just import `OrderService`?*
    *   **Answer:** If `EmailWatcher` imported `OrderService`, we would have tight coupling. The email listener's only job is to read emails. By emitting an event, our system becomes highly scalable. If tomorrow we also want to send an SMS or a Telegram alert when a deposit arrives, we just add another listener to the event bus; we don't touch the email scraping code.
