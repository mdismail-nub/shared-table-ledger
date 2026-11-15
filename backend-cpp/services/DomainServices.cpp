#include "DomainServices.h"
#include "../repositories/DatabaseManager.h"
#include "../services/AccountingEngine.h"
#include "../utils/Crypto.h"
#include "../utils/DateUtils.h"
#include "../utils/CsvHelper.h"
#include "../validators/InputValidator.h"

namespace mess_manager {
namespace services {

// --- MemberService ---
std::vector<models::Member> MemberService::getMembers(const std::string &messId) {
    return repositories::DatabaseManager::instance().getMembersByMessId(messId);
}

std::pair<bool, std::string> MemberService::addMember(
    const std::string &messId,
    const std::string &name,
    const std::string &phone,
    const std::string &room
) {
    auto err = validators::InputValidator::validateMemberName(name);
    if (err.has_value()) return {false, *err};

    models::Member m;
    m.id = utils::Crypto::generateUuid();
    m.messId = messId;
    m.role = "member";
    m.name = name;
    m.phone = phone.substr(0, 30);
    m.room = room.substr(0, 30);
    m.joined = utils::DateUtils::getCurrentLocalDate();
    m.status = "active";
    m.tone = "primary";
    m.createdAt = utils::DateUtils::getCurrentLocalDate();

    bool ok = repositories::DatabaseManager::instance().addMember(m);
    return {ok, m.id};
}

bool MemberService::updateStatus(const std::string &memberId, const std::string &status) {
    auto &db = repositories::DatabaseManager::instance();
    auto memOpt = db.getMemberById(memberId);
    if (!memOpt.has_value()) return false;

    auto m = *memOpt;
    m.status = status;
    return db.updateMember(m);
}

bool MemberService::deleteMember(const std::string &memberId) {
    return repositories::DatabaseManager::instance().deleteMember(memberId);
}

// --- MealService ---
std::vector<models::Meal> MealService::getMealsForMonth(const std::string &messId, const std::string &month) {
    auto range = utils::DateUtils::getMonthRange(month);
    return repositories::DatabaseManager::instance().getMeals(messId, range.first, range.second);
}

bool MealService::upsertDailyMeals(const std::vector<models::Meal> &meals) {
    for (const auto &m : meals) {
        if (validators::InputValidator::validateMealCount(m.breakfast) ||
            validators::InputValidator::validateMealCount(m.lunch) ||
            validators::InputValidator::validateMealCount(m.dinner)) {
            return false;
        }
    }
    return repositories::DatabaseManager::instance().upsertMeals(meals);
}

// --- ExpenseService ---
std::vector<models::Expense> ExpenseService::getExpensesForMonth(const std::string &messId, const std::string &month) {
    auto range = utils::DateUtils::getMonthRange(month);
    return repositories::DatabaseManager::instance().getExpenses(messId, range.first, range.second);
}

std::pair<bool, std::string> ExpenseService::addExpense(
    const std::string &messId,
    const std::string &date,
    const std::string &type,
    const std::string &category,
    const std::string &description,
    double amount,
    const std::optional<std::string> &memberId,
    const std::string &method
) {
    auto amountErr = validators::InputValidator::validateAmount(amount);
    if (amountErr.has_value()) return {false, *amountErr};

    auto typeErr = validators::InputValidator::validateExpenseType(type);
    if (typeErr.has_value()) return {false, *typeErr};

    models::Expense e;
    e.id = utils::Crypto::generateUuid();
    e.messId = messId;
    e.date = date.empty() ? utils::DateUtils::getCurrentLocalDate() : date;
    e.type = type;
    e.category = category.substr(0, 60);
    e.description = description.substr(0, 300);
    e.amount = amount;
    e.memberId = memberId;
    e.method = method.empty() ? "Cash" : method;
    e.createdAt = utils::DateUtils::getCurrentLocalDate();

    bool ok = repositories::DatabaseManager::instance().addExpense(e);
    return {ok, e.id};
}

bool ExpenseService::deleteExpense(const std::string &expenseId) {
    return repositories::DatabaseManager::instance().deleteExpense(expenseId);
}

// --- PaymentService ---
std::vector<models::Payment> PaymentService::getPaymentsForMonth(const std::string &messId, const std::string &month) {
    auto range = utils::DateUtils::getMonthRange(month);
    return repositories::DatabaseManager::instance().getPayments(messId, range.first, range.second);
}

std::pair<bool, std::string> PaymentService::recordPayment(
    const std::string &messId,
    const std::string &date,
    const std::string &memberId,
    double amount,
    const std::string &method,
    const std::string &reference
) {
    auto amountErr = validators::InputValidator::validateAmount(amount);
    if (amountErr.has_value()) return {false, *amountErr};

    models::Payment p;
    p.id = utils::Crypto::generateUuid();
    p.messId = messId;
    p.date = date.empty() ? utils::DateUtils::getCurrentLocalDate() : date;
    p.memberId = memberId;
    p.amount = amount;
    p.method = method.empty() ? "Cash" : method;
    p.kind = "Deposit";
    p.reference = reference.substr(0, 100);
    p.createdAt = utils::DateUtils::getCurrentLocalDate();

    bool ok = repositories::DatabaseManager::instance().addPayment(p);
    return {ok, p.id};
}

bool PaymentService::deletePayment(const std::string &paymentId) {
    return repositories::DatabaseManager::instance().deletePayment(paymentId);
}

// --- NotificationService ---
std::pair<bool, std::string> NotificationService::sendNotification(
    const std::string &messId,
    const std::optional<std::string> &senderId,
    const std::optional<std::string> &recipientId,
    const std::string &title,
    const std::string &message,
    const std::string &type
) {
    auto titleErr = validators::InputValidator::validateNotificationTitle(title);
    if (titleErr.has_value()) return {false, *titleErr};

    auto msgErr = validators::InputValidator::validateNotificationMessage(message);
    if (msgErr.has_value()) return {false, *msgErr};

    models::Notification n;
    n.id = utils::Crypto::generateUuid();
    n.messId = messId;
    n.senderId = senderId;
    n.recipientId = recipientId;
    n.title = title;
    n.message = message;
    n.type = type.empty() ? "notice" : type;
    n.createdAt = utils::DateUtils::getCurrentLocalDate();

    bool ok = repositories::DatabaseManager::instance().addNotification(n);
    return {ok, n.id};
}

bool NotificationService::deleteNotification(const std::string &notificationId) {
    return repositories::DatabaseManager::instance().deleteNotification(notificationId);
}

// --- ReportService ---
std::string ReportService::exportCsv(const std::string &messId, const std::string &month) {
    auto &db = repositories::DatabaseManager::instance();
    auto range = utils::DateUtils::getMonthRange(month);

    auto members = db.getMembersByMessId(messId);
    auto meals = db.getMeals(messId, range.first, range.second);
    auto expenses = db.getExpenses(messId, range.first, range.second);
    auto payments = db.getPayments(messId, range.first, range.second);

    auto summary = AccountingEngine::generateSummary(expenses, meals, payments, members);
    auto ledger = AccountingEngine::buildLedger(members, meals, payments, summary.mealRate, summary.householdShare);

    return utils::CsvHelper::generateLedgerCsv(ledger, month);
}

} // namespace services
} // namespace mess_manager
