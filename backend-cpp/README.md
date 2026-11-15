# Mess Manager — C++ Drogon REST Backend

## Overview
High-performance, modern C++17 RESTful backend for the **Shared Table Ledger (Mess Management System)**. Built with the **Drogon C++ Web Framework**, **PostgreSQL**, and **CMake**.

This backend implements all core business logic, role-based authorization, member lifecycle management, daily meal tracking, and the mathematical accounting engine.

---

## Directory Structure

```text
backend-cpp/
├── CMakeLists.txt                 # Modern CMake build configuration (FetchContent support)
├── main.cpp                       # Drogon application entrypoint & listener
├── config/
│   └── config.json                # Server, database, CORS, and JWT configuration
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
│   └── SettingsController.h / .cpp# Mess settings and invite code regeneration
├── services/                      # Core Domain & Business Logic Services
│   ├── AccountingEngine.h / .cpp  # Mathematical source of truth for meal rates & dues
│   ├── AuthService.h / .cpp       # SHA-256 password hashing & JWT generation
│   ├── WorkspaceService.h / .cpp  # Multi-tenant workspace data aggregator
│   └── DomainServices.h / .cpp    # Member, meal, expense, and notification operations
├── repositories/                  # Data Access & Database Management
│   └── DatabaseManager.h / .cpp   # PostgreSQL connection & thread-safe persistence
├── models/                        # Strongly-typed Domain Models & JSON Mappings
│   ├── Mess.h, Member.h, Meal.h, Expense.h, Payment.h, Notification.h, AccountingModels.h, User.h
├── middleware/                    # Drogon HTTP Filters
│   ├── AuthFilter.h / .cpp        # Bearer JWT / guest token validator
│   └── CorsFilter.h / .cpp        # Cross-Origin Resource Sharing (CORS) handler
├── validators/                    # Business Rule & Input Validation
│   └── InputValidator.h / .cpp    # Input length, regex, bounds, and date checks
├── utils/                         # Cryptography, Tokens & Date Tools
│   ├── Crypto.h / .cpp            # FIPS 180-4 SHA-256, HMAC-SHA256, UUID & invite codes
│   ├── JwtHelper.h / .cpp         # HS256 JWT token generation & verification
│   ├── DateUtils.h / .cpp         # Local calendar calculations (Bangladesh timezone safe)
│   └── CsvHelper.h / .cpp         # Formula-injection safe RFC-4180 CSV generator
└── tests/                         # Automated Unit & Integration Tests
    └── AccountingEngineTest.cpp   # Comprehensive unit tests for accounting math & edge cases
```

---

## Prerequisites
- **C++ Compiler:** C++17 or newer (MSVC 2019/2022, GCC 9+, or Clang 10+)
- **Build System:** CMake 3.16+ and Ninja or Make
- **Database (Optional):** PostgreSQL 12+ (or run in Standalone mode with local persistence)
- **Framework:** Drogon (`v1.8+` or `v1.9+`)

---

## Build & Test Instructions

### 1. Build and Run the Automated Test Suite
The test executable (`mess_manager_tests`) tests the accounting engine, JWT engine, validation, and CSV sanitization:

```bash
cd backend-cpp
mkdir build
cd build
cmake .. -G "Visual Studio 17 2022" -A x64   # On Windows with Visual Studio
# Or on Linux/macOS: cmake .. -GNinja
cmake --build . --config Release --target mess_manager_tests
ctest --output-on-failure                    # Or run ./mess_manager_tests
```

### 2. Run the C++ Drogon REST Server
```bash
cmake --build . --config Release --target mess_manager_server
./mess_manager_server ../config/config.json
```
The server will start listening on `http://0.0.0.0:8080`.
