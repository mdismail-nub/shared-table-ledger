#pragma once

#include <string>
#include <vector>
#include <optional>
#include <utility>
#include "../models/Member.h"
#include "../models/Meal.h"
#include "../models/Expense.h"
#include "../models/Payment.h"
#include "../models/Notification.h"

namespace mess_manager {
namespace services {

class MemberService {
public:
    static std::vector<models::Member> getMembers(const std::string &messId);
    static std::pair<bool, std::string> addMember(
        const std::string &messId,
        const std::string &name,
        const std::string &phone,
        const std::string &room
    );
    static bool updateStatus(const std::string &memberId, const std::string &status);
    static bool deleteMember(const std::string &memberId);
};

class MealService {
public:
    static std::vector<models::Meal> getMealsForMonth(const std::string &messId, const std::string &month);
    static bool upsertDailyMeals(const std::vector<models::Meal> &meals);
};

class ExpenseService {
public:
    static std::vector<models::Expense> getExpensesForMonth(const std::string &messId, const std::string &month);
    static std::pair<bool, std::string> addExpense(
        const std::string &messId,
        const std::string &date,
        const std::string &type,
        const std::string &category,
        const std::string &description,
        double amount,
        const std::optional<std::string> &memberId,
        const std::string &method
    );
    static bool deleteExpense(const std::string &expenseId);
};

class PaymentService {
public:
    static std::vector<models::Payment> getPaymentsForMonth(const std::string &messId, const std::string &month);
    static std::pair<bool, std::string> recordPayment(
        const std::string &messId,
        const std::string &date,
        const std::string &memberId,
        double amount,
        const std::string &method,
        const std::string &reference
    );
    static bool deletePayment(const std::string &paymentId);
};

class NotificationService {
public:
    static std::pair<bool, std::string> sendNotification(
        const std::string &messId,
        const std::optional<std::string> &senderId,
        const std::optional<std::string> &recipientId,
        const std::string &title,
        const std::string &message,
        const std::string &type
    );
    static bool deleteNotification(const std::string &notificationId);
};

class ReportService {
public:
    static std::string exportCsv(const std::string &messId, const std::string &month);
};

} // namespace services
} // namespace mess_manager
