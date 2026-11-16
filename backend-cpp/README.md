# Mess Manager — C++ Drogon REST Backend

## Overview
High-performance, modern C++17 RESTful backend for the **Shared Table Ledger (Mess Management System)**. Built with the **Drogon C++ Web Framework**, **PostgreSQL (libpq)**, **OpenSSL**, **JsonCpp**, and **CMake**.

This backend implements all core business logic, role-based authorization, member lifecycle management, daily meal tracking, and the mathematical accounting engine.

---

## Directory Structure

```text
backend-cpp/
├── CMakeLists.txt                 # Modern CMake build configuration (libpq & Drogon detection)
├── Dockerfile                     # Multi-stage production container build (Ubuntu 22.04)
├── .env.example                   # Environment configuration template
├── DEPLOYMENT.md                  # Comprehensive Render & PostgreSQL deployment guide
├── main.cpp                       # Application entrypoint, environment parser & startup validator
├── config/
│   └── config.json                # Server, database, CORS, and logging configuration
├── migrations/
│   └── 0001_initial_schema.sql    # Forward database schema migration for PostgreSQL
├── controllers/                   # Drogon HTTP REST Controllers
│   ├── AuthController.h / .cpp    # Admin register, login, and guest token endpoints
│   ├── WorkspaceController.h/.cpp # Full workspace data and preview endpoints
│   ├── MemberController.h / .cpp  # Member roster management & status updates
│   ├── MealController.h / .cpp    # Daily meal sheet logging & totals
│   ├── ExpenseController.h / .cpp # Food & household utility expense tracking
│   ├── PaymentController.h / .cpp # Member deposit recording
│   ├── AccountingController.h/.cpp# Monthly ledger, summary, and individual statements
│   ├── NotificationController.h/.cpp # Real-time announcements and alerts
│   ├── ReportController.h / .cpp  # RFC-4180 CSV report export
│   ├── SettingsController.h / .cpp# Mess settings and invite code regeneration
│   └── HealthController.h / .cpp  # /api/health and uptime diagnostic endpoint
├── services/                      # Core Domain & Business Logic Services
│   ├── AccountingEngine.h / .cpp  # Mathematical source of truth for meal rates & dues
│   ├── AuthService.h / .cpp       # SHA-256 password hashing & JWT generation
│   ├── WorkspaceService.h / .cpp  # Multi-tenant workspace data aggregator
│   └── DomainServices.h / .cpp    # Member, meal, expense, and notification operations
├── repositories/                  # Data Access & Database Management
│   ├── PgClient.h / .cpp          # Direct PostgreSQL libpq client with connection pooling & params
│   └── DatabaseManager.h / .cpp   # Parameterized SQL queries, auto-migrations, & fallback store
├── models/                        # Strongly-typed Domain Models & JSON Mappings
│   ├── Mess.h, Member.h, Meal.h, Expense.h, Payment.h, Notification.h, AccountingModels.h, User.h
├── middleware/                    # Drogon HTTP Filters
│   ├── AuthFilter.h / .cpp        # Bearer JWT / guest token validator
│   └── CorsFilter.h / .cpp        # Dynamic Cross-Origin Resource Sharing (CORS) handler
├── validators/                    # Business Rule & Input Validation
│   └── InputValidator.h / .cpp    # Input length, regex, bounds, and date checks
├── utils/                         # Cryptography, Tokens & Date Tools
│   ├── Crypto.h / .cpp            # FIPS 180-4 SHA-256, HMAC-SHA256, UUID & invite codes
│   ├── JwtHelper.h / .cpp         # HS256 JWT token generation & verification
│   ├── DateUtils.h / .cpp         # Local calendar calculations (Bangladesh timezone safe)
│   └── CsvHelper.h / .cpp         # Formula-injection safe RFC-4180 CSV generator
└── tests/                         # Automated Unit & Integration Tests
    └── AccountingEngineTest.cpp   # Comprehensive unit tests for accounting math, edge cases, & auth
```

---

## Build & Test Instructions

### 1. Build and Run the Automated Test Suite
The test executable (`mess_manager_tests`) tests the accounting engine, edge cases, JWT authentication, validation, and CSV sanitization:

```bash
cd backend-cpp
cmake -B build -DCMAKE_BUILD_TYPE=Release
cmake --build build --config Release
./build/bin/Release/mess_manager_tests    # On Windows: .\build\bin\Release\mess_manager_tests.exe
```

### 2. Run the C++ Drogon REST Server Locally
```bash
./build/bin/Release/mess_manager_server
```
The server will start listening on `http://0.0.0.0:8080`.

### 3. Build the Docker Image
```bash
docker build -t mess-manager-backend:latest .
```

---

## REST API Endpoints Reference

| Method | Endpoint | Protection | Description |
|---|---|---|---|
| `GET` | `/api/health` | Public | Service health & database connectivity status |
| `POST` | `/api/auth/register` | Public | Register new admin account and provision mess |
| `POST` | `/api/auth/login` | Public | Authenticate admin user with email and password |
| `GET` | `/api/auth/me` | Bearer Token | Get current authenticated user profile |
| `GET` | `/api/workspace` | Authenticated | Retrieve complete workspace data for active month |
| `GET` | `/api/members` | Authenticated | List all members in the current mess |
| `POST` | `/api/members` | Admin Only | Add a new member to the mess roster |
| `PUT` | `/api/members/{id}` | Admin Only | Update existing member details |
| `DELETE`| `/api/members/{id}` | Admin Only | Remove a member |
| `GET` | `/api/meals` | Authenticated | Fetch meals for date range |
| `POST` | `/api/meals` | Admin Only | Batch upsert daily meals |
| `GET` | `/api/expenses` | Authenticated | Fetch food & household expenses |
| `POST` | `/api/expenses` | Admin Only | Add expense entry |
| `DELETE`| `/api/expenses/{id}`| Admin Only | Remove expense entry |
| `GET` | `/api/payments` | Authenticated | List member payments & deposits |
| `POST` | `/api/payments` | Admin Only | Record deposit payment |
| `DELETE`| `/api/payments/{id}`| Admin Only | Remove payment entry |
| `GET` | `/api/accounting/summary`| Authenticated | Get calculated meal rate and monthly summary |
| `GET` | `/api/notifications`| Authenticated | Retrieve member announcements |
| `POST` | `/api/notifications`| Admin Only | Broadcast notice or reminder |
| `GET` | `/api/settings` | Admin Only | Fetch mess configurations |
| `PUT` | `/api/settings` | Admin Only | Update mess configuration settings |
| `POST` | `/api/guest/session` | Public | Validate invite code & create guest session |
