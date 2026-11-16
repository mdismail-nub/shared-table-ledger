#include <iostream>
#include <cassert>
#include <cmath>
#include <vector>
#include <string>
#include <sstream>
#include "../services/AccountingEngine.h"
#include "../utils/Crypto.h"
#include "../utils/JwtHelper.h"
#include "../utils/CsvHelper.h"
#include "../validators/InputValidator.h"

using namespace mess_manager;

#define TEST_ASSERT(cond, msg) \
    do { \
        if (!(cond)) { \
            std::cerr << "[-] FAILED: " << msg << " (at line " << __LINE__ << ")\n"; \
            std::exit(1); \
        } else { \
            std::cout << "[+] PASSED: " << msg << "\n"; \
        } \
    } while (0)

bool doubleEquals(double a, double b, double epsilon = 0.001) {
    return std::fabs(a - b) < epsilon;
}

void testMealRateCalculations() {
    std::cout << "\n--- Testing Meal Rate Calculations ---\n";

    // 1. Standard calculation: ৳30,000 food expense / 600 meals = ৳50.00 / meal
    double rate1 = services::AccountingEngine::calculateMealRate(30000.0, 600.0);
    TEST_ASSERT(doubleEquals(rate1, 50.0), "Standard meal rate (30000 / 600 = 50.0)");

    // 2. Fractional calculation: ৳23,456.78 / 412.5 meals = ৳56.8649
    double rate2 = services::AccountingEngine::calculateMealRate(23456.78, 412.5);
    TEST_ASSERT(doubleEquals(rate2, 56.8649, 0.01), "Fractional meal rate precision");

    // 3. Zero meals edge case: Must safely return 0.0 without division by zero
    double rateZeroMeals = services::AccountingEngine::calculateMealRate(15000.0, 0.0);
    TEST_ASSERT(doubleEquals(rateZeroMeals, 0.0), "Zero meals returns rate 0.0 safely");

    // 4. Negative meals edge case: Must return 0.0
    double rateNegativeMeals = services::AccountingEngine::calculateMealRate(15000.0, -10.0);
    TEST_ASSERT(doubleEquals(rateNegativeMeals, 0.0), "Negative meals returns rate 0.0 safely");

    // 5. Zero expenses edge case: 0 / 500 = 0.0
    double rateZeroExpense = services::AccountingEngine::calculateMealRate(0.0, 500.0);
    TEST_ASSERT(doubleEquals(rateZeroExpense, 0.0), "Zero expenses returns rate 0.0");
}

void testHouseholdBillAllocation() {
    std::cout << "\n--- Testing Household Utility Allocation ---\n";

    // 1. Standard allocation: ৳6,000 utility bills / 6 active members = ৳1,000 / member
    double share1 = services::AccountingEngine::calculateHouseholdShare(6000.0, 6);
    TEST_ASSERT(doubleEquals(share1, 1000.0), "Standard household share (6000 / 6 = 1000.0)");

    // 2. Zero active members edge case: Must return 0.0 without division by zero
    double shareZeroMembers = services::AccountingEngine::calculateHouseholdShare(6000.0, 0);
    TEST_ASSERT(doubleEquals(shareZeroMembers, 0.0), "Zero members returns share 0.0 safely");

    // 3. Zero utility expenses: 0 / 5 = 0.0
    double shareZeroExpense = services::AccountingEngine::calculateHouseholdShare(0.0, 5);
    TEST_ASSERT(doubleEquals(shareZeroExpense, 0.0), "Zero expenses returns share 0.0");
}

void testMemberBalanceCalculations() {
    std::cout << "\n--- Testing Member Balance & Due Equations ---\n";

    // Scenario A: Member with surplus deposit
    // Deposits = ৳3000, Meals = 40, Meal Rate = ৳50, Shared Bill = ৳500
    // Meal Cost = 40 * 50 = ৳2000
    // Due = 2000 + 500 = ৳2500
    // Balance = 3000 - 2500 = +৳500 (Surplus)
    auto balA = services::AccountingEngine::calculateMemberBalance(3000.0, 40.0, 50.0, 500.0);
    TEST_ASSERT(doubleEquals(balA.mealCost, 2000.0), "Surplus member: meal cost = 2000");
    TEST_ASSERT(doubleEquals(balA.due, 2500.0), "Surplus member: total due = 2500");
    TEST_ASSERT(doubleEquals(balA.balance, 500.0), "Surplus member: net balance = +500");

    // Scenario B: Member with deficit (owes money to mess)
    // Deposits = ৳1000, Meals = 40, Meal Rate = ৳50, Shared Bill = ৳500
    // Due = ৳2500, Balance = 1000 - 2500 = -৳1500 (Deficit)
    auto balB = services::AccountingEngine::calculateMemberBalance(1000.0, 40.0, 50.0, 500.0);
    TEST_ASSERT(doubleEquals(balB.balance, -1500.0), "Deficit member: net balance = -1500");

    // Scenario C: Member with 0 deposits
    auto balC = services::AccountingEngine::calculateMemberBalance(0.0, 30.0, 50.0, 500.0);
    TEST_ASSERT(doubleEquals(balC.balance, -2000.0), "Zero deposit member: balance = -due (-2000)");

    // Scenario D: Member with 0 meals (e.g. away for the whole month)
    // Meals = 0, Deposits = ৳1000, Shared Bill = ৳500
    // Meal Cost = 0, Due = 500, Balance = 1000 - 500 = +৳500
    auto balD = services::AccountingEngine::calculateMemberBalance(1000.0, 0.0, 50.0, 500.0);
    TEST_ASSERT(doubleEquals(balD.mealCost, 0.0), "Zero meal member: meal cost = 0");
    TEST_ASSERT(doubleEquals(balD.due, 500.0), "Zero meal member: due = shared bill (500)");
    TEST_ASSERT(doubleEquals(balD.balance, 500.0), "Zero meal member: balance = +500");
}

void testMonthlyLedgerAndExemptions() {
    std::cout << "\n--- Testing Multi-Member Monthly Ledger ---\n";

    std::vector<models::Member> members = {
        {"m1", "mess1", std::nullopt, "admin", "Tanvir Ahmed", "01711111111", "301", "2026-01-01", "active", "primary", ""},
        {"m2", "mess1", std::nullopt, "member", "Rakib Hasan", "01722222222", "302", "2026-02-01", "active", "mint", ""},
        {"m3", "mess1", std::nullopt, "member", "Former Member", "01733333333", "303", "2026-01-01", "left", "peach", ""}
    };

    std::vector<models::Meal> meals = {
        {"ml1", "mess1", "m1", "2026-11-01", 1.0, 1.0, 1.0}, // m1: 3 meals
        {"ml2", "mess1", "m2", "2026-11-01", 0.0, 1.0, 1.0}, // m2: 2 meals
        {"ml3", "mess1", "m3", "2026-11-01", 0.0, 0.0, 1.0}  // m3: 1 meal
    };

    std::vector<models::Payment> payments = {
        {"p1", "mess1", "2026-11-01", "m1", 500.0, "Cash", "Deposit", "Ref1", ""},
        {"p2", "mess1", "2026-11-01", "m2", 200.0, "bKash", "Deposit", "Ref2", ""}
    };

    double rate = 50.0;
    double sharedBill = 100.0;

    auto ledger = services::AccountingEngine::buildLedger(members, meals, payments, rate, sharedBill);
    TEST_ASSERT(ledger.size() == 3, "Ledger has exactly 3 rows");

    // Member 1 (Active): meals = 3, mealCost = 150, shared = 100, due = 250, deposits = 500, balance = +250
    TEST_ASSERT(doubleEquals(ledger[0].meals, 3.0), "Member 1 meal count = 3");
    TEST_ASSERT(doubleEquals(ledger[0].mealCost, 150.0), "Member 1 meal cost = 150");
    TEST_ASSERT(doubleEquals(ledger[0].shared, 100.0), "Member 1 shared bill = 100");
    TEST_ASSERT(doubleEquals(ledger[0].due, 250.0), "Member 1 total due = 250");
    TEST_ASSERT(doubleEquals(ledger[0].balance, 250.0), "Member 1 balance = +250");

    // Member 2 (Active): meals = 2, mealCost = 100, shared = 100, due = 200, deposits = 200, balance = 0
    TEST_ASSERT(doubleEquals(ledger[1].meals, 2.0), "Member 2 meal count = 2");
    TEST_ASSERT(doubleEquals(ledger[1].due, 200.0), "Member 2 due = 200");
    TEST_ASSERT(doubleEquals(ledger[1].balance, 0.0), "Member 2 balance = 0 (settled)");

    // Member 3 (Status == 'left'): Former member skips shared bills!
    // meals = 1, mealCost = 50, shared = 0.0, due = 50, deposits = 0, balance = -50
    TEST_ASSERT(doubleEquals(ledger[2].meals, 1.0), "Left member meals = 1");
    TEST_ASSERT(doubleEquals(ledger[2].shared, 0.0), "Left member skips shared bills (shared = 0.0)");
    TEST_ASSERT(doubleEquals(ledger[2].due, 50.0), "Left member total due = 50");
    TEST_ASSERT(doubleEquals(ledger[2].balance, -50.0), "Left member balance = -50");
}

void testCsvExportSanitization() {
    std::cout << "\n--- Testing CSV Sanitization & RFC 4180 ---\n";

    // 1. Normal cell escaping
    std::string cell1 = utils::CsvHelper::escapeCell("Standard Name");
    TEST_ASSERT(cell1 == "\"Standard Name\"", "Normal text quoted properly");

    // 2. Cell containing internal quotes
    std::string cell2 = utils::CsvHelper::escapeCell("John \"The Cook\" Doe");
    TEST_ASSERT(cell2 == "\"John \"\"The Cook\"\" Doe\"", "Internal quotes doubled");

    // 3. Formula injection prevention (OWASP): begins with '='
    std::string formulaCell = utils::CsvHelper::escapeCell("=SUM(A1:A10)");
    TEST_ASSERT(formulaCell == "\"'=SUM(A1:A10)\"", "Formula cell prepended with single quote");

    // 4. Formula injection prevention: begins with '+'
    std::string plusCell = utils::CsvHelper::escapeCell("+123456");
    TEST_ASSERT(plusCell.find("'+123456") != std::string::npos, "Plus cell sanitized");

    // 5. Full ledger CSV contains UTF-8 BOM
    std::vector<models::LedgerRow> rows = {
        {"m1", "Tanvir Ahmed", "active", "301", "primary", 10.0, 500.0, 200.0, 700.0, 1000.0, 300.0}
    };
    std::string csv = utils::CsvHelper::generateLedgerCsv(rows, "2026-11");
    TEST_ASSERT(csv.rfind("\xEF\xBB\xBF", 0) == 0, "CSV has UTF-8 BOM for Excel");
    TEST_ASSERT(csv.find("\"Tanvir Ahmed\"") != std::string::npos, "CSV contains member name");
}

void testJwtAndCryptography() {
    std::cout << "\n--- Testing JWT & SHA-256 Cryptography ---\n";

    std::string secret = "test_super_secret_key_12345";
    std::string token = utils::JwtHelper::createToken(
        "usr_123", "admin", "mess_abc", "mem_456", secret, 3600
    );
    TEST_ASSERT(!token.empty(), "JWT generated successfully");

    int64_t now = 1000000;
    // Verify valid token
    auto claimsOpt = utils::JwtHelper::verifyToken(token, secret, now);
    TEST_ASSERT(claimsOpt.has_value(), "Valid token passes verification");
    TEST_ASSERT(claimsOpt->userId == "usr_123", "Token userId matches claims");
    TEST_ASSERT(claimsOpt->role == "admin", "Token role matches claims");
    TEST_ASSERT(claimsOpt->messId == "mess_abc", "Token messId matches claims");
    TEST_ASSERT(claimsOpt->memberId.value_or("") == "mem_456", "Token memberId matches claims");

    // Verify invalid signature rejected
    auto badSig = utils::JwtHelper::verifyToken(token, "wrong_secret", now);
    TEST_ASSERT(!badSig.has_value(), "Invalid signature rejected");

    // SHA-256 test vector: sha256("") = e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
    std::string emptyHash = utils::Crypto::sha256("");
    TEST_ASSERT(emptyHash == "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855", "SHA-256 empty string matches FIPS test vector");
}

void testValidationRules() {
    std::cout << "\n--- Testing Input Validation Rules ---\n";

    // 1. Mess name
    TEST_ASSERT(!validators::InputValidator::validateMessName("My Mess").has_value(), "Valid mess name accepted");
    TEST_ASSERT(validators::InputValidator::validateMessName("A").has_value(), "Short mess name rejected (< 2 chars)");

    // 2. 6-digit invite code
    TEST_ASSERT(!validators::InputValidator::validateInviteCode("123456").has_value(), "Valid 6-digit code accepted");
    TEST_ASSERT(validators::InputValidator::validateInviteCode("12345").has_value(), "5-digit code rejected");
    TEST_ASSERT(validators::InputValidator::validateInviteCode("12345A").has_value(), "Alpha code rejected");

    // 3. Amount
    TEST_ASSERT(!validators::InputValidator::validateAmount(500.0).has_value(), "Valid amount accepted");
    TEST_ASSERT(validators::InputValidator::validateAmount(0.0).has_value(), "Zero amount rejected");
    TEST_ASSERT(validators::InputValidator::validateAmount(-50.0).has_value(), "Negative amount rejected");

    // 4. Meal slot count
    TEST_ASSERT(!validators::InputValidator::validateMealCount(1.5).has_value(), "Valid meal count accepted");
    TEST_ASSERT(validators::InputValidator::validateMealCount(-0.5).has_value(), "Negative meal count rejected");
    TEST_ASSERT(validators::InputValidator::validateMealCount(15.0).has_value(), "Excessive meal count (>10) rejected");
}

void testAccountingEdgeCases() {
    std::cout << "\n--- Testing Accounting Edge Cases ---\n";

    // Scenario 1: Equal consumption across all members
    // 3 active members, each eating 20 meals. Total meals = 60. Food expense = 6000.
    // Rate = 6000 / 60 = 100.0. Household = 1500 / 3 = 500.0.
    std::vector<models::Member> members = {
        {"m1", "mess1", std::nullopt, "admin", "Alice", "0171", "101", "2026-11-01", "active", "primary", ""},
        {"m2", "mess1", std::nullopt, "member", "Bob", "0172", "102", "2026-11-01", "active", "mint", ""},
        {"m3", "mess1", std::nullopt, "member", "Charlie", "0173", "103", "2026-11-01", "active", "peach", ""}
    };
    std::vector<models::Meal> meals = {
        {"ml1", "mess1", "m1", "2026-11-01", 10.0, 10.0, 0.0},
        {"ml2", "mess1", "m2", "2026-11-01", 10.0, 10.0, 0.0},
        {"ml3", "mess1", "m3", "2026-11-01", 10.0, 10.0, 0.0}
    };
    std::vector<models::Payment> payments = {
        {"p1", "mess1", "2026-11-01", "m1", 2500.0, "Cash", "Deposit", "", ""},
        {"p2", "mess1", "2026-11-01", "m2", 2000.0, "bKash", "Deposit", "", ""},
        {"p3", "mess1", "2026-11-01", "m3", 0.0, "Cash", "Deposit", "", ""}
    };

    double rate = services::AccountingEngine::calculateMealRate(6000.0, 60.0);
    double shared = services::AccountingEngine::calculateHouseholdShare(1500.0, 3);
    TEST_ASSERT(doubleEquals(rate, 100.0), "Equal consumption rate = 100.0");
    TEST_ASSERT(doubleEquals(shared, 500.0), "Household share = 500.0");

    auto ledger = services::AccountingEngine::buildLedger(members, meals, payments, rate, shared);
    TEST_ASSERT(ledger.size() == 3, "Ledger size is 3");

    // Alice: deposits = 2500, due = 2000 + 500 = 2500, balance = 0.0
    TEST_ASSERT(doubleEquals(ledger[0].balance, 0.0), "Alice is perfectly settled (balance = 0.0)");

    // Bob: deposits = 2000, due = 2500, balance = -500.0
    TEST_ASSERT(doubleEquals(ledger[1].balance, -500.0), "Bob owes 500.0 (balance = -500.0)");

    // Charlie: deposits = 0, due = 2500, balance = -2500.0
    TEST_ASSERT(doubleEquals(ledger[2].balance, -2500.0), "Charlie owes full due 2500.0 (balance = -2500.0)");

    // Scenario 2: Zero food expense with active meals
    double zeroRate = services::AccountingEngine::calculateMealRate(0.0, 50.0);
    TEST_ASSERT(doubleEquals(zeroRate, 0.0), "Zero food expense yields rate 0.0");

    // Scenario 3: Negative balance math precision
    auto bal = services::AccountingEngine::calculateMemberBalance(123.45, 10.0, 55.55, 200.0);
    // mealCost = 555.50, due = 755.50, balance = 123.45 - 755.50 = -632.05
    TEST_ASSERT(doubleEquals(bal.mealCost, 555.50, 0.01), "Meal cost precision check");
    TEST_ASSERT(doubleEquals(bal.due, 755.50, 0.01), "Due precision check");
    TEST_ASSERT(doubleEquals(bal.balance, -632.05, 0.01), "Negative balance precision check");
}

int main() {
    std::cout << "========================================================\n";
    std::cout << "  Shared Table Ledger — C++ Backend Automated Tests     \n";
    std::cout << "========================================================\n";

    testMealRateCalculations();
    testHouseholdBillAllocation();
    testMemberBalanceCalculations();
    testMonthlyLedgerAndExemptions();
    testCsvExportSanitization();
    testJwtAndCryptography();
    testValidationRules();
    testAccountingEdgeCases();

    std::cout << "\n========================================================\n";
    std::cout << "  ALL C++ UNIT TESTS PASSED SUCCESSFULLY! (100% GREEN)  \n";
    std::cout << "========================================================\n";
    return 0;
}
