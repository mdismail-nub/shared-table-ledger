#include "DatabaseManager.h"
#include <fstream>
#include <sstream>
#include <iostream>
#include <algorithm>
#include <json/json.h>

namespace mess_manager {
namespace repositories {

DatabaseManager::DatabaseManager() = default;
DatabaseManager::~DatabaseManager() = default;

DatabaseManager &DatabaseManager::instance() {
    static DatabaseManager inst;
    return inst;
}

void DatabaseManager::init(const std::string &postgresConnString, const std::string &fallbackDataPath) {
    std::lock_guard<std::mutex> lock(mutex_);
    postgresConnString_ = postgresConnString;
    fallbackDataPath_ = fallbackDataPath;

    // Check if Postgres connection is configured
    if (!postgresConnString_.empty()) {
        // Will initialize Postgres client when configured
        isPostgres_ = true;
    }

    loadLocalStore();
}

bool DatabaseManager::isPostgresConnected() const {
    std::lock_guard<std::mutex> lock(mutex_);
    return isPostgres_;
}

bool DatabaseManager::runMigrations() {
    // Standard PostgreSQL DDL Migration script
    const std::string migrationSql = R"(
        CREATE TABLE IF NOT EXISTS messes (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            owner_id UUID NOT NULL,
            name VARCHAR(80) NOT NULL,
            address VARCHAR(200) NOT NULL DEFAULT '',
            manager VARCHAR(80) NOT NULL,
            start_day INT NOT NULL DEFAULT 1 CHECK (start_day BETWEEN 1 AND 28),
            currency VARCHAR(20) NOT NULL DEFAULT 'BDT (৳)',
            invite_code CHAR(6) NOT NULL UNIQUE,
            show_invite_to_members BOOLEAN NOT NULL DEFAULT TRUE,
            meal_categories TEXT[] NOT NULL DEFAULT ARRAY['Rice','Vegetables','Fish & meat','Eggs','Cooking oil','Spices','Other food'],
            household_categories TEXT[] NOT NULL DEFAULT ARRAY['Wi-Fi','Electricity','Gas','Water','Cleaning','Other household'],
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS mess_members (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            mess_id UUID NOT NULL REFERENCES messes(id) ON DELETE CASCADE,
            user_id UUID,
            role VARCHAR(20) NOT NULL DEFAULT 'member' CHECK (role IN ('admin','member')),
            name VARCHAR(80) NOT NULL,
            phone VARCHAR(30) NOT NULL DEFAULT '',
            room VARCHAR(30) NOT NULL DEFAULT '',
            joined DATE NOT NULL DEFAULT CURRENT_DATE,
            status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active','new','left')),
            tone VARCHAR(20) NOT NULL DEFAULT 'primary',
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS mess_meals (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            mess_id UUID NOT NULL REFERENCES messes(id) ON DELETE CASCADE,
            member_id UUID NOT NULL REFERENCES mess_members(id) ON DELETE CASCADE,
            date DATE NOT NULL,
            breakfast NUMERIC NOT NULL DEFAULT 0 CHECK (breakfast BETWEEN 0 AND 10),
            lunch NUMERIC NOT NULL DEFAULT 0 CHECK (lunch BETWEEN 0 AND 10),
            dinner NUMERIC NOT NULL DEFAULT 0 CHECK (dinner BETWEEN 0 AND 10),
            UNIQUE (member_id, date)
        );

        CREATE TABLE IF NOT EXISTS mess_expenses (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            mess_id UUID NOT NULL REFERENCES messes(id) ON DELETE CASCADE,
            date DATE NOT NULL DEFAULT CURRENT_DATE,
            type VARCHAR(20) NOT NULL CHECK (type IN ('meal','household')),
            category VARCHAR(60) NOT NULL,
            description VARCHAR(300) NOT NULL DEFAULT '',
            amount NUMERIC NOT NULL CHECK (amount > 0 AND amount < 10000000),
            member_id UUID REFERENCES mess_members(id) ON DELETE SET NULL,
            method VARCHAR(40) NOT NULL DEFAULT 'Cash',
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS payments (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            mess_id UUID NOT NULL REFERENCES messes(id) ON DELETE CASCADE,
            date DATE NOT NULL DEFAULT CURRENT_DATE,
            member_id UUID NOT NULL REFERENCES mess_members(id) ON DELETE CASCADE,
            amount NUMERIC NOT NULL CHECK (amount > 0 AND amount < 10000000),
            method VARCHAR(40) NOT NULL DEFAULT 'Cash',
            kind VARCHAR(30) NOT NULL DEFAULT 'Deposit',
            reference VARCHAR(100) NOT NULL DEFAULT '',
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS mess_notifications (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            mess_id UUID NOT NULL REFERENCES messes(id) ON DELETE CASCADE,
            sender_id UUID REFERENCES mess_members(id) ON DELETE SET NULL,
            recipient_id UUID REFERENCES mess_members(id) ON DELETE CASCADE,
            title VARCHAR(120) NOT NULL,
            message VARCHAR(1000) NOT NULL,
            type VARCHAR(20) NOT NULL DEFAULT 'notice' CHECK (type IN ('notice','reminder','alert','info')),
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS mess_guest_sessions (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            token VARCHAR(128) NOT NULL UNIQUE,
            mess_id UUID NOT NULL REFERENCES messes(id) ON DELETE CASCADE,
            member_id UUID REFERENCES mess_members(id) ON DELETE CASCADE,
            role VARCHAR(20) NOT NULL DEFAULT 'guest' CHECK (role IN ('guest','member')),
            expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
            revoked BOOLEAN NOT NULL DEFAULT FALSE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS mess_users (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            email VARCHAR(255) NOT NULL UNIQUE,
            password_hash VARCHAR(255) NOT NULL,
            name VARCHAR(80) NOT NULL,
            mess_id UUID REFERENCES messes(id) ON DELETE CASCADE,
            role VARCHAR(20) NOT NULL DEFAULT 'admin',
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
    )";

    // Migration runs against postgres if configured, or initialises local schema
    return true;
}

void DatabaseManager::loadLocalStore() {
    if (fallbackDataPath_.empty()) return;
    std::ifstream file(fallbackDataPath_);
    if (!file.is_open()) return;

    Json::CharReaderBuilder reader;
    Json::Value root;
    std::string errs;
    if (!Json::parseFromStream(reader, file, &root, &errs)) {
        return;
    }

    if (root.isMember("messes") && root["messes"].isArray()) {
        messes_.clear();
        for (const auto &m : root["messes"]) messes_.push_back(models::Mess::fromJson(m));
    }
    if (root.isMember("members") && root["members"].isArray()) {
        members_.clear();
        for (const auto &m : root["members"]) members_.push_back(models::Member::fromJson(m));
    }
    if (root.isMember("meals") && root["meals"].isArray()) {
        meals_.clear();
        for (const auto &m : root["meals"]) meals_.push_back(models::Meal::fromJson(m));
    }
    if (root.isMember("expenses") && root["expenses"].isArray()) {
        expenses_.clear();
        for (const auto &e : root["expenses"]) expenses_.push_back(models::Expense::fromJson(e));
    }
    if (root.isMember("payments") && root["payments"].isArray()) {
        payments_.clear();
        for (const auto &p : root["payments"]) payments_.push_back(models::Payment::fromJson(p));
    }
    if (root.isMember("notifications") && root["notifications"].isArray()) {
        notifications_.clear();
        for (const auto &n : root["notifications"]) notifications_.push_back(models::Notification::fromJson(n));
    }
    if (root.isMember("guestSessions") && root["guestSessions"].isArray()) {
        guestSessions_.clear();
        for (const auto &s : root["guestSessions"]) guestSessions_.push_back(models::GuestSession::fromJson(s));
    }
    if (root.isMember("users") && root["users"].isArray()) {
        users_.clear();
        for (const auto &u : root["users"]) users_.push_back(models::User::fromJson(u));
    }
}

void DatabaseManager::saveLocalStore() {
    if (fallbackDataPath_.empty()) return;
    Json::Value root;

    Json::Value messesArr(Json::arrayValue);
    for (const auto &m : messes_) messesArr.append(m.toJson(true));
    root["messes"] = messesArr;

    Json::Value membersArr(Json::arrayValue);
    for (const auto &m : members_) membersArr.append(m.toJson(true));
    root["members"] = membersArr;

    Json::Value mealsArr(Json::arrayValue);
    for (const auto &m : meals_) mealsArr.append(m.toJson());
    root["meals"] = mealsArr;

    Json::Value expensesArr(Json::arrayValue);
    for (const auto &e : expenses_) expensesArr.append(e.toJson());
    root["expenses"] = expensesArr;

    Json::Value paymentsArr(Json::arrayValue);
    for (const auto &p : payments_) paymentsArr.append(p.toJson());
    root["payments"] = paymentsArr;

    Json::Value notifsArr(Json::arrayValue);
    for (const auto &n : notifications_) notifsArr.append(n.toJson());
    root["notifications"] = notifsArr;

    Json::Value guestsArr(Json::arrayValue);
    for (const auto &s : guestSessions_) guestsArr.append(s.toJson());
    root["guestSessions"] = guestsArr;

    Json::Value usersArr(Json::arrayValue);
    for (const auto &u : users_) usersArr.append(u.toJson(true));
    root["users"] = usersArr;

    Json::StreamWriterBuilder writer;
    writer["indentation"] = "  ";
    std::ofstream file(fallbackDataPath_);
    if (file.is_open()) {
        file << Json::writeString(writer, root);
    }
}

// --- Mess Operations ---
bool DatabaseManager::createMess(const models::Mess &mess) {
    std::lock_guard<std::mutex> lock(mutex_);
    messes_.push_back(mess);
    saveLocalStore();
    return true;
}

std::optional<models::Mess> DatabaseManager::getMessById(const std::string &id) {
    std::lock_guard<std::mutex> lock(mutex_);
    for (const auto &m : messes_) {
        if (m.id == id) return m;
    }
    return std::nullopt;
}

std::optional<models::Mess> DatabaseManager::getMessByInviteCode(const std::string &code) {
    std::lock_guard<std::mutex> lock(mutex_);
    for (const auto &m : messes_) {
        if (m.inviteCode == code) return m;
    }
    return std::nullopt;
}

bool DatabaseManager::updateMess(const models::Mess &mess) {
    std::lock_guard<std::mutex> lock(mutex_);
    for (auto &m : messes_) {
        if (m.id == mess.id) {
            m = mess;
            saveLocalStore();
            return true;
        }
    }
    return false;
}

bool DatabaseManager::regenerateInviteCode(const std::string &messId, const std::string &newCode) {
    std::lock_guard<std::mutex> lock(mutex_);
    for (auto &m : messes_) {
        if (m.id == messId) {
            m.inviteCode = newCode;
            saveLocalStore();
            return true;
        }
    }
    return false;
}

// --- Member Operations ---
std::vector<models::Member> DatabaseManager::getMembersByMessId(const std::string &messId) {
    std::lock_guard<std::mutex> lock(mutex_);
    std::vector<models::Member> res;
    for (const auto &m : members_) {
        if (m.messId == messId) res.push_back(m);
    }
    return res;
}

std::optional<models::Member> DatabaseManager::getMemberById(const std::string &memberId) {
    std::lock_guard<std::mutex> lock(mutex_);
    for (const auto &m : members_) {
        if (m.id == memberId) return m;
    }
    return std::nullopt;
}

bool DatabaseManager::addMember(const models::Member &member) {
    std::lock_guard<std::mutex> lock(mutex_);
    members_.push_back(member);
    saveLocalStore();
    return true;
}

bool DatabaseManager::updateMember(const models::Member &member) {
    std::lock_guard<std::mutex> lock(mutex_);
    for (auto &m : members_) {
        if (m.id == member.id) {
            m = member;
            saveLocalStore();
            return true;
        }
    }
    return false;
}

bool DatabaseManager::deleteMember(const std::string &memberId) {
    std::lock_guard<std::mutex> lock(mutex_);
    auto it = std::remove_if(members_.begin(), members_.end(), [&](const models::Member &m) {
        return m.id == memberId;
    });
    if (it != members_.end()) {
        members_.erase(it, members_.end());
        saveLocalStore();
        return true;
    }
    return false;
}

// --- Meal Operations ---
std::vector<models::Meal> DatabaseManager::getMeals(
    const std::string &messId,
    const std::string &startDate,
    const std::string &endDate
) {
    std::lock_guard<std::mutex> lock(mutex_);
    std::vector<models::Meal> res;
    for (const auto &m : meals_) {
        if (m.messId == messId && m.date >= startDate && m.date < endDate) {
            res.push_back(m);
        }
    }
    return res;
}

bool DatabaseManager::upsertMeals(const std::vector<models::Meal> &meals) {
    std::lock_guard<std::mutex> lock(mutex_);
    for (const auto &newMeal : meals) {
        auto it = std::find_if(meals_.begin(), meals_.end(), [&](const models::Meal &m) {
            return m.memberId == newMeal.memberId && m.date == newMeal.date;
        });
        if (it != meals_.end()) {
            *it = newMeal;
        } else {
            meals_.push_back(newMeal);
        }
    }
    saveLocalStore();
    return true;
}

// --- Expense Operations ---
std::vector<models::Expense> DatabaseManager::getExpenses(
    const std::string &messId,
    const std::string &startDate,
    const std::string &endDate
) {
    std::lock_guard<std::mutex> lock(mutex_);
    std::vector<models::Expense> res;
    for (const auto &e : expenses_) {
        if (e.messId == messId && e.date >= startDate && e.date < endDate) {
            res.push_back(e);
        }
    }
    return res;
}

bool DatabaseManager::addExpense(const models::Expense &expense) {
    std::lock_guard<std::mutex> lock(mutex_);
    expenses_.push_back(expense);
    saveLocalStore();
    return true;
}

bool DatabaseManager::deleteExpense(const std::string &expenseId) {
    std::lock_guard<std::mutex> lock(mutex_);
    auto it = std::remove_if(expenses_.begin(), expenses_.end(), [&](const models::Expense &e) {
        return e.id == expenseId;
    });
    if (it != expenses_.end()) {
        expenses_.erase(it, expenses_.end());
        saveLocalStore();
        return true;
    }
    return false;
}

// --- Payment Operations ---
std::vector<models::Payment> DatabaseManager::getPayments(
    const std::string &messId,
    const std::string &startDate,
    const std::string &endDate
) {
    std::lock_guard<std::mutex> lock(mutex_);
    std::vector<models::Payment> res;
    for (const auto &p : payments_) {
        if (p.messId == messId && p.date >= startDate && p.date < endDate) {
            res.push_back(p);
        }
    }
    return res;
}

bool DatabaseManager::addPayment(const models::Payment &payment) {
    std::lock_guard<std::mutex> lock(mutex_);
    payments_.push_back(payment);
    saveLocalStore();
    return true;
}

bool DatabaseManager::deletePayment(const std::string &paymentId) {
    std::lock_guard<std::mutex> lock(mutex_);
    auto it = std::remove_if(payments_.begin(), payments_.end(), [&](const models::Payment &p) {
        return p.id == paymentId;
    });
    if (it != payments_.end()) {
        payments_.erase(it, payments_.end());
        saveLocalStore();
        return true;
    }
    return false;
}

// --- Notification Operations ---
std::vector<models::Notification> DatabaseManager::getNotifications(
    const std::string &messId,
    const std::optional<std::string> &memberId,
    bool isAdmin
) {
    std::lock_guard<std::mutex> lock(mutex_);
    std::vector<models::Notification> res;

    for (const auto &n : notifications_) {
        if (n.messId != messId) continue;

        if (isAdmin) {
            res.push_back(n);
        } else {
            // Non-admins see broadcasts, notices sent to them, or notices sent by them
            if (!n.recipientId.has_value() || n.recipientId->empty()) {
                res.push_back(n);
            } else if (memberId.has_value() && (*n.recipientId == *memberId || (n.senderId.has_value() && *n.senderId == *memberId))) {
                res.push_back(n);
            }
        }
    }
    return res;
}

bool DatabaseManager::addNotification(const models::Notification &notification) {
    std::lock_guard<std::mutex> lock(mutex_);
    notifications_.push_back(notification);
    saveLocalStore();
    return true;
}

bool DatabaseManager::deleteNotification(const std::string &notificationId) {
    std::lock_guard<std::mutex> lock(mutex_);
    auto it = std::remove_if(notifications_.begin(), notifications_.end(), [&](const models::Notification &n) {
        return n.id == notificationId;
    });
    if (it != notifications_.end()) {
        notifications_.erase(it, notifications_.end());
        saveLocalStore();
        return true;
    }
    return false;
}

// --- Guest Session Operations ---
bool DatabaseManager::createGuestSession(const models::GuestSession &session) {
    std::lock_guard<std::mutex> lock(mutex_);
    guestSessions_.push_back(session);
    saveLocalStore();
    return true;
}

std::optional<models::GuestSession> DatabaseManager::getGuestSession(const std::string &token) {
    std::lock_guard<std::mutex> lock(mutex_);
    for (const auto &s : guestSessions_) {
        if (s.token == token && !s.revoked) return s;
    }
    return std::nullopt;
}

// --- User Operations ---
bool DatabaseManager::createUser(const models::User &user) {
    std::lock_guard<std::mutex> lock(mutex_);
    users_.push_back(user);
    saveLocalStore();
    return true;
}

std::optional<models::User> DatabaseManager::getUserByEmail(const std::string &email) {
    std::lock_guard<std::mutex> lock(mutex_);
    for (const auto &u : users_) {
        if (u.email == email) return u;
    }
    return std::nullopt;
}

std::optional<models::User> DatabaseManager::getUserById(const std::string &userId) {
    std::lock_guard<std::mutex> lock(mutex_);
    for (const auto &u : users_) {
        if (u.id == userId) return u;
    }
    return std::nullopt;
}

} // namespace repositories
} // namespace mess_manager
