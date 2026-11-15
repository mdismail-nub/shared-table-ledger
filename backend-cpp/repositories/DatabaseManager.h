#pragma once

#include <string>
#include <vector>
#include <optional>
#include <memory>
#include <mutex>
#include "../models/Mess.h"
#include "../models/Member.h"
#include "../models/Meal.h"
#include "../models/Expense.h"
#include "../models/Payment.h"
#include "../models/Notification.h"
#include "../models/GuestSession.h"
#include "../models/User.h"

namespace mess_manager {
namespace repositories {

class DatabaseManager {
public:
    static DatabaseManager &instance();

    // Initializes database manager with optional postgres connection string and local storage path
    void init(const std::string &postgresConnString, const std::string &fallbackDataPath);

    // Runs forward database migrations to ensure all tables, indexes, and constraints exist
    bool runMigrations();

    // Check if connected to real PostgreSQL
    bool isPostgresConnected() const;

    // --- Mess Operations ---
    bool createMess(const models::Mess &mess);
    std::optional<models::Mess> getMessById(const std::string &id);
    std::optional<models::Mess> getMessByInviteCode(const std::string &code);
    bool updateMess(const models::Mess &mess);
    bool regenerateInviteCode(const std::string &messId, const std::string &newCode);

    // --- Member Operations ---
    std::vector<models::Member> getMembersByMessId(const std::string &messId);
    std::optional<models::Member> getMemberById(const std::string &memberId);
    bool addMember(const models::Member &member);
    bool updateMember(const models::Member &member);
    bool deleteMember(const std::string &memberId);

    // --- Meal Operations ---
    std::vector<models::Meal> getMeals(const std::string &messId, const std::string &startDate, const std::string &endDate);
    bool upsertMeals(const std::vector<models::Meal> &meals);

    // --- Expense Operations ---
    std::vector<models::Expense> getExpenses(const std::string &messId, const std::string &startDate, const std::string &endDate);
    bool addExpense(const models::Expense &expense);
    bool deleteExpense(const std::string &expenseId);

    // --- Payment Operations ---
    std::vector<models::Payment> getPayments(const std::string &messId, const std::string &startDate, const std::string &endDate);
    bool addPayment(const models::Payment &payment);
    bool deletePayment(const std::string &paymentId);

    // --- Notification Operations ---
    std::vector<models::Notification> getNotifications(
        const std::string &messId,
        const std::optional<std::string> &memberId,
        bool isAdmin
    );
    bool addNotification(const models::Notification &notification);
    bool deleteNotification(const std::string &notificationId);

    // --- Guest Session Operations ---
    bool createGuestSession(const models::GuestSession &session);
    std::optional<models::GuestSession> getGuestSession(const std::string &token);

    // --- User Operations ---
    bool createUser(const models::User &user);
    std::optional<models::User> getUserByEmail(const std::string &email);
    std::optional<models::User> getUserById(const std::string &userId);

private:
    DatabaseManager();
    ~DatabaseManager();
    DatabaseManager(const DatabaseManager &) = delete;
    DatabaseManager &operator=(const DatabaseManager &) = delete;

    void loadLocalStore();
    void saveLocalStore();

    mutable std::mutex mutex_;
    std::string postgresConnString_;
    std::string fallbackDataPath_;
    bool isPostgres_{false};

    // In-memory / persistent file cache structures for reliable local / offline operation
    std::vector<models::Mess> messes_;
    std::vector<models::Member> members_;
    std::vector<models::Meal> meals_;
    std::vector<models::Expense> expenses_;
    std::vector<models::Payment> payments_;
    std::vector<models::Notification> notifications_;
    std::vector<models::GuestSession> guestSessions_;
    std::vector<models::User> users_;
};

} // namespace repositories
} // namespace mess_manager
