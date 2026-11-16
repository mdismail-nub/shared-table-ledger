#include "DatabaseManager.h"
#include <fstream>
#include <sstream>
#include <iostream>
#include <algorithm>
#include <json/json.h>
#include "../utils/Crypto.h"

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

    if (!postgresConnString_.empty()) {
        bool ok = PgClient::instance().connect(postgresConnString_);
        if (ok) {
            isPostgres_ = true;
            std::cout << "[Database] Successfully connected to PostgreSQL instance!\n";
        } else {
            isPostgres_ = false;
            std::cerr << "[Database] PostgreSQL connection failed: " << PgClient::instance().getLastError() << "\n";
        }
    } else {
        isPostgres_ = false;
    }

    if (!isPostgres_) {
        loadLocalStore();
    }
}

bool DatabaseManager::isPostgresConnected() const {
    std::lock_guard<std::mutex> lock(mutex_);
    return isPostgres_ && PgClient::instance().isConnected();
}

std::string DatabaseManager::getPostgresError() const {
    return PgClient::instance().getLastError();
}

bool DatabaseManager::runMigrations() {
    if (isPostgresConnected()) {
        const std::string migrationSql = R"(
            CREATE TABLE IF NOT EXISTS messes (
                id VARCHAR(64) PRIMARY KEY DEFAULT gen_random_uuid()::text,
                owner_id VARCHAR(64) NOT NULL,
                name VARCHAR(80) NOT NULL,
                address VARCHAR(200) NOT NULL DEFAULT '',
                manager VARCHAR(80) NOT NULL DEFAULT '',
                start_day INT NOT NULL DEFAULT 1 CHECK (start_day BETWEEN 1 AND 28),
                currency VARCHAR(20) NOT NULL DEFAULT 'BDT (৳)',
                invite_code CHAR(6) NOT NULL UNIQUE,
                show_invite_to_members BOOLEAN NOT NULL DEFAULT TRUE,
                meal_categories TEXT[] NOT NULL DEFAULT ARRAY['Rice','Vegetables','Fish & meat','Eggs','Cooking oil','Spices','Other food'],
                household_categories TEXT[] NOT NULL DEFAULT ARRAY['Wi-Fi','Electricity','Gas','Water','Cleaning','Other household'],
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS mess_members (
                id VARCHAR(64) PRIMARY KEY DEFAULT gen_random_uuid()::text,
                mess_id VARCHAR(64) NOT NULL REFERENCES messes(id) ON DELETE CASCADE,
                user_id VARCHAR(64),
                role VARCHAR(20) NOT NULL DEFAULT 'member' CHECK (role IN ('admin','member')),
                name VARCHAR(80) NOT NULL,
                phone VARCHAR(30) NOT NULL DEFAULT '',
                room VARCHAR(30) NOT NULL DEFAULT '',
                joined DATE NOT NULL DEFAULT CURRENT_DATE,
                status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active','new','left')),
                tone VARCHAR(20) NOT NULL DEFAULT 'primary',
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );

            CREATE UNIQUE INDEX IF NOT EXISTS mess_members_one_mess_per_user ON mess_members(user_id) WHERE user_id IS NOT NULL AND status <> 'left';
            CREATE INDEX IF NOT EXISTS idx_mess_members_mess_id ON mess_members(mess_id);

            CREATE TABLE IF NOT EXISTS mess_meals (
                id VARCHAR(64) PRIMARY KEY DEFAULT gen_random_uuid()::text,
                mess_id VARCHAR(64) NOT NULL REFERENCES messes(id) ON DELETE CASCADE,
                member_id VARCHAR(64) NOT NULL REFERENCES mess_members(id) ON DELETE CASCADE,
                date DATE NOT NULL,
                breakfast NUMERIC NOT NULL DEFAULT 0 CHECK (breakfast BETWEEN 0 AND 10),
                lunch NUMERIC NOT NULL DEFAULT 0 CHECK (lunch BETWEEN 0 AND 10),
                dinner NUMERIC NOT NULL DEFAULT 0 CHECK (dinner BETWEEN 0 AND 10),
                UNIQUE (member_id, date)
            );
            CREATE INDEX IF NOT EXISTS idx_mess_meals_mess_date ON mess_meals(mess_id, date);

            CREATE TABLE IF NOT EXISTS mess_expenses (
                id VARCHAR(64) PRIMARY KEY DEFAULT gen_random_uuid()::text,
                mess_id VARCHAR(64) NOT NULL REFERENCES messes(id) ON DELETE CASCADE,
                date DATE NOT NULL DEFAULT CURRENT_DATE,
                type VARCHAR(20) NOT NULL CHECK (type IN ('meal','household')),
                category VARCHAR(60) NOT NULL,
                description VARCHAR(300) NOT NULL DEFAULT '',
                amount NUMERIC NOT NULL CHECK (amount > 0 AND amount < 10000000),
                member_id VARCHAR(64) REFERENCES mess_members(id) ON DELETE SET NULL,
                method VARCHAR(40) NOT NULL DEFAULT 'Cash',
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
            CREATE INDEX IF NOT EXISTS idx_mess_expenses_mess_date ON mess_expenses(mess_id, date);

            CREATE TABLE IF NOT EXISTS payments (
                id VARCHAR(64) PRIMARY KEY DEFAULT gen_random_uuid()::text,
                mess_id VARCHAR(64) NOT NULL REFERENCES messes(id) ON DELETE CASCADE,
                date DATE NOT NULL DEFAULT CURRENT_DATE,
                member_id VARCHAR(64) NOT NULL REFERENCES mess_members(id) ON DELETE CASCADE,
                amount NUMERIC NOT NULL CHECK (amount > 0 AND amount < 10000000),
                method VARCHAR(40) NOT NULL DEFAULT 'Cash',
                kind VARCHAR(30) NOT NULL DEFAULT 'Deposit',
                reference VARCHAR(100) NOT NULL DEFAULT '',
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
            CREATE INDEX IF NOT EXISTS idx_payments_mess_date ON payments(mess_id, date);

            CREATE TABLE IF NOT EXISTS mess_notifications (
                id VARCHAR(64) PRIMARY KEY DEFAULT gen_random_uuid()::text,
                mess_id VARCHAR(64) NOT NULL REFERENCES messes(id) ON DELETE CASCADE,
                sender_id VARCHAR(64) REFERENCES mess_members(id) ON DELETE SET NULL,
                recipient_id VARCHAR(64) REFERENCES mess_members(id) ON DELETE CASCADE,
                title VARCHAR(120) NOT NULL,
                message VARCHAR(1000) NOT NULL,
                type VARCHAR(20) NOT NULL DEFAULT 'notice' CHECK (type IN ('notice','reminder','alert','info')),
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
            CREATE INDEX IF NOT EXISTS idx_notifications_mess ON mess_notifications(mess_id);

            CREATE TABLE IF NOT EXISTS mess_guest_sessions (
                id VARCHAR(64) PRIMARY KEY DEFAULT gen_random_uuid()::text,
                token VARCHAR(128) NOT NULL UNIQUE,
                mess_id VARCHAR(64) NOT NULL REFERENCES messes(id) ON DELETE CASCADE,
                member_id VARCHAR(64) REFERENCES mess_members(id) ON DELETE CASCADE,
                role VARCHAR(20) NOT NULL DEFAULT 'guest' CHECK (role IN ('guest','member')),
                expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
                revoked BOOLEAN NOT NULL DEFAULT FALSE,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
            CREATE INDEX IF NOT EXISTS idx_guest_sessions_token ON mess_guest_sessions(token);

            CREATE TABLE IF NOT EXISTS mess_users (
                id VARCHAR(64) PRIMARY KEY DEFAULT gen_random_uuid()::text,
                email VARCHAR(255) NOT NULL UNIQUE,
                password_hash VARCHAR(255) NOT NULL,
                name VARCHAR(80) NOT NULL,
                mess_id VARCHAR(64) REFERENCES messes(id) ON DELETE CASCADE,
                role VARCHAR(20) NOT NULL DEFAULT 'admin',
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
            CREATE INDEX IF NOT EXISTS idx_users_email ON mess_users(email);
        )";

        auto res = PgClient::instance().exec(migrationSql);
        if (!res.ok()) {
            std::cerr << "[Database] Migration execution error: " << res.error() << "\n";
            return false;
        }
        std::cout << "[Database] PostgreSQL schema migration complete.\n";
        return true;
    }
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

    Json::Value sessionsArr(Json::arrayValue);
    for (const auto &s : guestSessions_) sessionsArr.append(s.toJson());
    root["guestSessions"] = sessionsArr;

    Json::Value usersArr(Json::arrayValue);
    for (const auto &u : users_) usersArr.append(u.toJson());
    root["users"] = usersArr;

    std::ofstream file(fallbackDataPath_);
    if (file.is_open()) {
        Json::StreamWriterBuilder writer;
        writer["indentation"] = "  ";
        std::unique_ptr<Json::StreamWriter> jsonWriter(writer.newStreamWriter());
        jsonWriter->write(root, &file);
    }
}

// ==========================================
// Mess Operations
// ==========================================

bool DatabaseManager::createMess(models::Mess mess) {
    if (mess.id.empty()) mess.id = utils::Crypto::generateUuid();

    if (isPostgresConnected()) {
        auto res = PgClient::instance().execParams(
            "INSERT INTO messes (id, owner_id, name, address, manager, start_day, currency, invite_code, show_invite_to_members) "
            "VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)",
            {
                mess.id,
                mess.ownerId,
                mess.name,
                mess.address,
                mess.manager,
                std::to_string(mess.startDay),
                mess.currency,
                mess.inviteCode,
                mess.showInviteToMembers ? "true" : "false"
            }
        );
        return res.ok();
    }

    std::lock_guard<std::mutex> lock(mutex_);
    messes_.push_back(mess);
    saveLocalStore();
    return true;
}

std::optional<models::Mess> DatabaseManager::getMessById(const std::string &id) {
    if (isPostgresConnected()) {
        auto res = PgClient::instance().execParams(
            "SELECT id, owner_id, name, address, manager, start_day, currency, invite_code, show_invite_to_members, created_at "
            "FROM messes WHERE id = $1 LIMIT 1",
            {id}
        );
        if (res.ok() && !res.empty()) {
            const auto &row = res[0];
            models::Mess m;
            m.id = row.get("id");
            m.ownerId = row.get("owner_id");
            m.name = row.get("name");
            m.address = row.get("address");
            m.manager = row.get("manager");
            m.startDay = row.getInt("start_day", 1);
            m.currency = row.get("currency", "BDT (৳)");
            m.inviteCode = row.get("invite_code");
            m.showInviteToMembers = row.getBool("show_invite_to_members", true);
            m.createdAt = row.get("created_at");
            return m;
        }
        return std::nullopt;
    }

    std::lock_guard<std::mutex> lock(mutex_);
    auto it = std::find_if(messes_.begin(), messes_.end(), [&](const models::Mess &m) { return m.id == id; });
    if (it != messes_.end()) return *it;
    return std::nullopt;
}

std::optional<models::Mess> DatabaseManager::getMessByInviteCode(const std::string &code) {
    if (isPostgresConnected()) {
        auto res = PgClient::instance().execParams(
            "SELECT id, owner_id, name, address, manager, start_day, currency, invite_code, show_invite_to_members, created_at "
            "FROM messes WHERE invite_code = $1 LIMIT 1",
            {code}
        );
        if (res.ok() && !res.empty()) {
            const auto &row = res[0];
            models::Mess m;
            m.id = row.get("id");
            m.ownerId = row.get("owner_id");
            m.name = row.get("name");
            m.address = row.get("address");
            m.manager = row.get("manager");
            m.startDay = row.getInt("start_day", 1);
            m.currency = row.get("currency", "BDT (৳)");
            m.inviteCode = row.get("invite_code");
            m.showInviteToMembers = row.getBool("show_invite_to_members", true);
            m.createdAt = row.get("created_at");
            return m;
        }
        return std::nullopt;
    }

    std::lock_guard<std::mutex> lock(mutex_);
    auto it = std::find_if(messes_.begin(), messes_.end(), [&](const models::Mess &m) { return m.inviteCode == code; });
    if (it != messes_.end()) return *it;
    return std::nullopt;
}

bool DatabaseManager::updateMess(const models::Mess &mess) {
    if (isPostgresConnected()) {
        auto res = PgClient::instance().execParams(
            "UPDATE messes SET name = $2, address = $3, manager = $4, start_day = $5, currency = $6, show_invite_to_members = $7 "
            "WHERE id = $1",
            {
                mess.id,
                mess.name,
                mess.address,
                mess.manager,
                std::to_string(mess.startDay),
                mess.currency,
                mess.showInviteToMembers ? "true" : "false"
            }
        );
        return res.ok();
    }

    std::lock_guard<std::mutex> lock(mutex_);
    for (auto &m : messes_) {
        if (m.id == mess.id) {
            m.name = mess.name;
            m.address = mess.address;
            m.manager = mess.manager;
            m.startDay = mess.startDay;
            m.currency = mess.currency;
            m.showInviteToMembers = mess.showInviteToMembers;
            m.mealCategories = mess.mealCategories;
            m.householdCategories = mess.householdCategories;
            saveLocalStore();
            return true;
        }
    }
    return false;
}

bool DatabaseManager::regenerateInviteCode(const std::string &messId, const std::string &newCode) {
    if (isPostgresConnected()) {
        auto res = PgClient::instance().execParams(
            "UPDATE messes SET invite_code = $2 WHERE id = $1",
            {messId, newCode}
        );
        return res.ok();
    }

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

// ==========================================
// Member Operations
// ==========================================

std::vector<models::Member> DatabaseManager::getMembersByMessId(const std::string &messId) {
    if (isPostgresConnected()) {
        auto res = PgClient::instance().execParams(
            "SELECT id, mess_id, user_id, role, name, phone, room, joined, status, tone, created_at "
            "FROM mess_members WHERE mess_id = $1 ORDER BY created_at ASC",
            {messId}
        );
        std::vector<models::Member> result;
        if (res.ok()) {
            for (const auto &row : res.rows()) {
                models::Member mem;
                mem.id = row.get("id");
                mem.messId = row.get("mess_id");
                mem.userId = row.isNull("user_id") ? std::nullopt : std::make_optional(row.get("user_id"));
                mem.role = row.get("role", "member");
                mem.name = row.get("name");
                mem.phone = row.get("phone");
                mem.room = row.get("room");
                mem.joined = row.get("joined");
                mem.status = row.get("status", "active");
                mem.tone = row.get("tone", "primary");
                mem.createdAt = row.get("created_at");
                result.push_back(mem);
            }
        }
        return result;
    }

    std::lock_guard<std::mutex> lock(mutex_);
    std::vector<models::Member> res;
    for (const auto &m : members_) {
        if (m.messId == messId) res.push_back(m);
    }
    return res;
}

std::optional<models::Member> DatabaseManager::getMemberById(const std::string &memberId) {
    if (isPostgresConnected()) {
        auto res = PgClient::instance().execParams(
            "SELECT id, mess_id, user_id, role, name, phone, room, joined, status, tone, created_at "
            "FROM mess_members WHERE id = $1 LIMIT 1",
            {memberId}
        );
        if (res.ok() && !res.empty()) {
            const auto &row = res[0];
            models::Member mem;
            mem.id = row.get("id");
            mem.messId = row.get("mess_id");
            mem.userId = row.isNull("user_id") ? std::nullopt : std::make_optional(row.get("user_id"));
            mem.role = row.get("role", "member");
            mem.name = row.get("name");
            mem.phone = row.get("phone");
            mem.room = row.get("room");
            mem.joined = row.get("joined");
            mem.status = row.get("status", "active");
            mem.tone = row.get("tone", "primary");
            mem.createdAt = row.get("created_at");
            return mem;
        }
        return std::nullopt;
    }

    std::lock_guard<std::mutex> lock(mutex_);
    auto it = std::find_if(members_.begin(), members_.end(), [&](const models::Member &m) { return m.id == memberId; });
    if (it != members_.end()) return *it;
    return std::nullopt;
}

bool DatabaseManager::addMember(models::Member member) {
    if (member.id.empty()) member.id = utils::Crypto::generateUuid();

    if (isPostgresConnected()) {
        auto res = PgClient::instance().execParams(
            "INSERT INTO mess_members (id, mess_id, user_id, role, name, phone, room, joined, status, tone) "
            "VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)",
            {
                member.id,
                member.messId,
                member.userId.value_or("__NULL__"),
                member.role,
                member.name,
                member.phone,
                member.room,
                member.joined,
                member.status,
                member.tone
            }
        );
        return res.ok();
    }

    std::lock_guard<std::mutex> lock(mutex_);
    members_.push_back(member);
    saveLocalStore();
    return true;
}

bool DatabaseManager::updateMember(const models::Member &member) {
    if (isPostgresConnected()) {
        auto res = PgClient::instance().execParams(
            "UPDATE mess_members SET name = $2, phone = $3, room = $4, role = $5, status = $6, tone = $7 "
            "WHERE id = $1",
            {
                member.id,
                member.name,
                member.phone,
                member.room,
                member.role,
                member.status,
                member.tone
            }
        );
        return res.ok();
    }

    std::lock_guard<std::mutex> lock(mutex_);
    for (auto &m : members_) {
        if (m.id == member.id) {
            m.name = member.name;
            m.phone = member.phone;
            m.room = member.room;
            m.role = member.role;
            m.status = member.status;
            m.tone = member.tone;
            saveLocalStore();
            return true;
        }
    }
    return false;
}

bool DatabaseManager::deleteMember(const std::string &memberId) {
    if (isPostgresConnected()) {
        auto res = PgClient::instance().execParams(
            "DELETE FROM mess_members WHERE id = $1",
            {memberId}
        );
        return res.ok();
    }

    std::lock_guard<std::mutex> lock(mutex_);
    auto it = std::remove_if(members_.begin(), members_.end(), [&](const models::Member &m) { return m.id == memberId; });
    if (it != members_.end()) {
        members_.erase(it, members_.end());
        saveLocalStore();
        return true;
    }
    return false;
}

// ==========================================
// Meal Operations
// ==========================================

std::vector<models::Meal> DatabaseManager::getMeals(const std::string &messId, const std::string &startDate, const std::string &endDate) {
    if (isPostgresConnected()) {
        auto res = PgClient::instance().execParams(
            "SELECT id, mess_id, member_id, date, breakfast, lunch, dinner "
            "FROM mess_meals WHERE mess_id = $1 AND date >= $2 AND date <= $3 ORDER BY date ASC",
            {messId, startDate, endDate}
        );
        std::vector<models::Meal> result;
        if (res.ok()) {
            for (const auto &row : res.rows()) {
                models::Meal m;
                m.id = row.get("id");
                m.messId = row.get("mess_id");
                m.memberId = row.get("member_id");
                m.date = row.get("date");
                m.breakfast = row.getDouble("breakfast", 0.0);
                m.lunch = row.getDouble("lunch", 0.0);
                m.dinner = row.getDouble("dinner", 0.0);
                result.push_back(m);
            }
        }
        return result;
    }

    std::lock_guard<std::mutex> lock(mutex_);
    std::vector<models::Meal> res;
    for (const auto &m : meals_) {
        if (m.messId == messId && m.date >= startDate && m.date <= endDate) {
            res.push_back(m);
        }
    }
    return res;
}

bool DatabaseManager::upsertMeals(const std::vector<models::Meal> &meals) {
    if (isPostgresConnected()) {
        bool allOk = true;
        for (auto m : meals) {
            if (m.id.empty()) m.id = utils::Crypto::generateUuid();
            auto res = PgClient::instance().execParams(
                "INSERT INTO mess_meals (id, mess_id, member_id, date, breakfast, lunch, dinner) "
                "VALUES ($1, $2, $3, $4, $5, $6, $7) "
                "ON CONFLICT (member_id, date) DO UPDATE SET "
                "breakfast = EXCLUDED.breakfast, lunch = EXCLUDED.lunch, dinner = EXCLUDED.dinner",
                {
                    m.id,
                    m.messId,
                    m.memberId,
                    m.date,
                    std::to_string(m.breakfast),
                    std::to_string(m.lunch),
                    std::to_string(m.dinner)
                }
            );
            if (!res.ok()) allOk = false;
        }
        return allOk;
    }

    std::lock_guard<std::mutex> lock(mutex_);
    for (const auto &meal : meals) {
        auto it = std::find_if(meals_.begin(), meals_.end(), [&](const models::Meal &m) {
            return m.memberId == meal.memberId && m.date == meal.date;
        });
        if (it != meals_.end()) {
            it->breakfast = meal.breakfast;
            it->lunch = meal.lunch;
            it->dinner = meal.dinner;
        } else {
            meals_.push_back(meal);
        }
    }
    saveLocalStore();
    return true;
}

// ==========================================
// Expense Operations
// ==========================================

std::vector<models::Expense> DatabaseManager::getExpenses(const std::string &messId, const std::string &startDate, const std::string &endDate) {
    if (isPostgresConnected()) {
        auto res = PgClient::instance().execParams(
            "SELECT id, mess_id, date, type, category, description, amount, member_id, method, created_at "
            "FROM mess_expenses WHERE mess_id = $1 AND date >= $2 AND date <= $3 "
            "ORDER BY date DESC, created_at DESC",
            {messId, startDate, endDate}
        );
        std::vector<models::Expense> result;
        if (res.ok()) {
            for (const auto &row : res.rows()) {
                models::Expense e;
                e.id = row.get("id");
                e.messId = row.get("mess_id");
                e.date = row.get("date");
                e.type = row.get("type", "meal");
                e.category = row.get("category");
                e.description = row.get("description");
                e.amount = row.getDouble("amount", 0.0);
                e.memberId = row.isNull("member_id") ? std::nullopt : std::make_optional(row.get("member_id"));
                e.method = row.get("method", "Cash");
                e.createdAt = row.get("created_at");
                result.push_back(e);
            }
        }
        return result;
    }

    std::lock_guard<std::mutex> lock(mutex_);
    std::vector<models::Expense> res;
    for (const auto &e : expenses_) {
        if (e.messId == messId && e.date >= startDate && e.date <= endDate) {
            res.push_back(e);
        }
    }
    return res;
}

bool DatabaseManager::addExpense(models::Expense expense) {
    if (expense.id.empty()) expense.id = utils::Crypto::generateUuid();

    if (isPostgresConnected()) {
        auto res = PgClient::instance().execParams(
            "INSERT INTO mess_expenses (id, mess_id, date, type, category, description, amount, member_id, method) "
            "VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)",
            {
                expense.id,
                expense.messId,
                expense.date,
                expense.type,
                expense.category,
                expense.description,
                std::to_string(expense.amount),
                expense.memberId.value_or("__NULL__"),
                expense.method
            }
        );
        return res.ok();
    }

    std::lock_guard<std::mutex> lock(mutex_);
    expenses_.push_back(expense);
    saveLocalStore();
    return true;
}

bool DatabaseManager::deleteExpense(const std::string &expenseId) {
    if (isPostgresConnected()) {
        auto res = PgClient::instance().execParams(
            "DELETE FROM mess_expenses WHERE id = $1",
            {expenseId}
        );
        return res.ok();
    }

    std::lock_guard<std::mutex> lock(mutex_);
    auto it = std::remove_if(expenses_.begin(), expenses_.end(), [&](const models::Expense &e) { return e.id == expenseId; });
    if (it != expenses_.end()) {
        expenses_.erase(it, expenses_.end());
        saveLocalStore();
        return true;
    }
    return false;
}

// ==========================================
// Payment Operations
// ==========================================

std::vector<models::Payment> DatabaseManager::getPayments(const std::string &messId, const std::string &startDate, const std::string &endDate) {
    if (isPostgresConnected()) {
        auto res = PgClient::instance().execParams(
            "SELECT id, mess_id, date, member_id, amount, method, kind, reference, created_at "
            "FROM payments WHERE mess_id = $1 AND date >= $2 AND date <= $3 "
            "ORDER BY date DESC, created_at DESC",
            {messId, startDate, endDate}
        );
        std::vector<models::Payment> result;
        if (res.ok()) {
            for (const auto &row : res.rows()) {
                models::Payment p;
                p.id = row.get("id");
                p.messId = row.get("mess_id");
                p.date = row.get("date");
                p.memberId = row.get("member_id");
                p.amount = row.getDouble("amount", 0.0);
                p.method = row.get("method", "Cash");
                p.kind = row.get("kind", "Deposit");
                p.reference = row.get("reference");
                p.createdAt = row.get("created_at");
                result.push_back(p);
            }
        }
        return result;
    }

    std::lock_guard<std::mutex> lock(mutex_);
    std::vector<models::Payment> res;
    for (const auto &p : payments_) {
        if (p.messId == messId && p.date >= startDate && p.date <= endDate) {
            res.push_back(p);
        }
    }
    return res;
}

bool DatabaseManager::addPayment(models::Payment payment) {
    if (payment.id.empty()) payment.id = utils::Crypto::generateUuid();

    if (isPostgresConnected()) {
        auto res = PgClient::instance().execParams(
            "INSERT INTO payments (id, mess_id, date, member_id, amount, method, kind, reference) "
            "VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
            {
                payment.id,
                payment.messId,
                payment.date,
                payment.memberId,
                std::to_string(payment.amount),
                payment.method,
                payment.kind,
                payment.reference
            }
        );
        return res.ok();
    }

    std::lock_guard<std::mutex> lock(mutex_);
    payments_.push_back(payment);
    saveLocalStore();
    return true;
}

bool DatabaseManager::deletePayment(const std::string &paymentId) {
    if (isPostgresConnected()) {
        auto res = PgClient::instance().execParams(
            "DELETE FROM payments WHERE id = $1",
            {paymentId}
        );
        return res.ok();
    }

    std::lock_guard<std::mutex> lock(mutex_);
    auto it = std::remove_if(payments_.begin(), payments_.end(), [&](const models::Payment &p) { return p.id == paymentId; });
    if (it != payments_.end()) {
        payments_.erase(it, payments_.end());
        saveLocalStore();
        return true;
    }
    return false;
}

// ==========================================
// Notification Operations
// ==========================================

std::vector<models::Notification> DatabaseManager::getNotifications(
    const std::string &messId,
    const std::optional<std::string> &memberId,
    bool isAdmin
) {
    if (isPostgresConnected()) {
        PgResult res(false);
        if (memberId.has_value() && !memberId->empty()) {
            res = PgClient::instance().execParams(
                "SELECT id, mess_id, sender_id, recipient_id, title, message, type, created_at "
                "FROM mess_notifications WHERE mess_id = $1 AND (recipient_id = $2 OR recipient_id IS NULL) "
                "ORDER BY created_at DESC",
                {messId, *memberId}
            );
        } else if (isAdmin) {
            res = PgClient::instance().execParams(
                "SELECT id, mess_id, sender_id, recipient_id, title, message, type, created_at "
                "FROM mess_notifications WHERE mess_id = $1 ORDER BY created_at DESC",
                {messId}
            );
        } else {
            res = PgClient::instance().execParams(
                "SELECT id, mess_id, sender_id, recipient_id, title, message, type, created_at "
                "FROM mess_notifications WHERE mess_id = $1 AND recipient_id IS NULL ORDER BY created_at DESC",
                {messId}
            );
        }

        std::vector<models::Notification> result;
        if (res.ok()) {
            for (const auto &row : res.rows()) {
                models::Notification n;
                n.id = row.get("id");
                n.messId = row.get("mess_id");
                n.senderId = row.isNull("sender_id") ? std::nullopt : std::make_optional(row.get("sender_id"));
                n.recipientId = row.isNull("recipient_id") ? std::nullopt : std::make_optional(row.get("recipient_id"));
                n.title = row.get("title");
                n.message = row.get("message");
                n.type = row.get("type", "notice");
                n.createdAt = row.get("created_at");
                result.push_back(n);
            }
        }
        return result;
    }

    std::lock_guard<std::mutex> lock(mutex_);
    std::vector<models::Notification> res;
    for (const auto &n : notifications_) {
        if (n.messId != messId) continue;
        if (isAdmin || !n.recipientId.has_value() || (memberId.has_value() && n.recipientId == memberId)) {
            res.push_back(n);
        }
    }
    return res;
}

bool DatabaseManager::addNotification(models::Notification notification) {
    if (notification.id.empty()) notification.id = utils::Crypto::generateUuid();

    if (isPostgresConnected()) {
        auto res = PgClient::instance().execParams(
            "INSERT INTO mess_notifications (id, mess_id, sender_id, recipient_id, title, message, type) "
            "VALUES ($1, $2, $3, $4, $5, $6, $7)",
            {
                notification.id,
                notification.messId,
                notification.senderId.value_or("__NULL__"),
                notification.recipientId.value_or("__NULL__"),
                notification.title,
                notification.message,
                notification.type
            }
        );
        return res.ok();
    }

    std::lock_guard<std::mutex> lock(mutex_);
    notifications_.push_back(notification);
    saveLocalStore();
    return true;
}

bool DatabaseManager::deleteNotification(const std::string &notificationId) {
    if (isPostgresConnected()) {
        auto res = PgClient::instance().execParams(
            "DELETE FROM mess_notifications WHERE id = $1",
            {notificationId}
        );
        return res.ok();
    }

    std::lock_guard<std::mutex> lock(mutex_);
    auto it = std::remove_if(notifications_.begin(), notifications_.end(), [&](const models::Notification &n) { return n.id == notificationId; });
    if (it != notifications_.end()) {
        notifications_.erase(it, notifications_.end());
        saveLocalStore();
        return true;
    }
    return false;
}

// ==========================================
// Guest Session Operations
// ==========================================

bool DatabaseManager::createGuestSession(models::GuestSession session) {
    if (session.id.empty()) session.id = utils::Crypto::generateUuid();

    if (isPostgresConnected()) {
        auto res = PgClient::instance().execParams(
            "INSERT INTO mess_guest_sessions (id, token, mess_id, member_id, role, expires_at) "
            "VALUES ($1, $2, $3, $4, $5, $6)",
            {
                session.id,
                session.token,
                session.messId,
                session.memberId.value_or("__NULL__"),
                session.role,
                std::to_string(session.expiresAt)
            }
        );
        return res.ok();
    }

    std::lock_guard<std::mutex> lock(mutex_);
    guestSessions_.push_back(session);
    saveLocalStore();
    return true;
}

std::optional<models::GuestSession> DatabaseManager::getGuestSession(const std::string &token) {
    if (isPostgresConnected()) {
        auto res = PgClient::instance().execParams(
            "SELECT id, token, mess_id, member_id, role, expires_at, revoked, created_at "
            "FROM mess_guest_sessions WHERE token = $1 AND revoked = FALSE AND expires_at > NOW() LIMIT 1",
            {token}
        );
        if (res.ok() && !res.empty()) {
            const auto &row = res[0];
            models::GuestSession s;
            s.id = row.get("id");
            s.token = row.get("token");
            s.messId = row.get("mess_id");
            s.memberId = row.isNull("member_id") ? std::nullopt : std::make_optional(row.get("member_id"));
            s.role = row.get("role", "guest");
            s.expiresAt = static_cast<int64_t>(row.getInt("expires_at", 0));
            s.revoked = row.getBool("revoked", false);
            s.createdAt = row.get("created_at");
            return s;
        }
        return std::nullopt;
    }

    std::lock_guard<std::mutex> lock(mutex_);
    auto it = std::find_if(guestSessions_.begin(), guestSessions_.end(), [&](const models::GuestSession &s) {
        return s.token == token && !s.revoked;
    });
    if (it != guestSessions_.end()) return *it;
    return std::nullopt;
}

// ==========================================
// User Operations
// ==========================================

bool DatabaseManager::createUser(models::User user) {
    if (user.id.empty()) user.id = utils::Crypto::generateUuid();

    if (isPostgresConnected()) {
        auto res = PgClient::instance().execParams(
            "INSERT INTO mess_users (id, email, password_hash, name, mess_id, role) "
            "VALUES ($1, $2, $3, $4, $5, $6)",
            {
                user.id,
                user.email,
                user.passwordHash,
                user.name,
                user.messId.empty() ? "__NULL__" : user.messId,
                user.role
            }
        );
        return res.ok();
    }

    std::lock_guard<std::mutex> lock(mutex_);
    users_.push_back(user);
    saveLocalStore();
    return true;
}

std::optional<models::User> DatabaseManager::getUserByEmail(const std::string &email) {
    if (isPostgresConnected()) {
        auto res = PgClient::instance().execParams(
            "SELECT id, email, password_hash, name, mess_id, role, created_at "
            "FROM mess_users WHERE LOWER(email) = LOWER($1) LIMIT 1",
            {email}
        );
        if (res.ok() && !res.empty()) {
            const auto &row = res[0];
            models::User u;
            u.id = row.get("id");
            u.email = row.get("email");
            u.passwordHash = row.get("password_hash");
            u.name = row.get("name");
            u.messId = row.get("mess_id");
            u.role = row.get("role", "admin");
            u.createdAt = row.get("created_at");
            return u;
        }
        return std::nullopt;
    }

    std::lock_guard<std::mutex> lock(mutex_);
    auto it = std::find_if(users_.begin(), users_.end(), [&](const models::User &u) {
        return u.email == email;
    });
    if (it != users_.end()) return *it;
    return std::nullopt;
}

std::optional<models::User> DatabaseManager::getUserById(const std::string &userId) {
    if (isPostgresConnected()) {
        auto res = PgClient::instance().execParams(
            "SELECT id, email, password_hash, name, mess_id, role, created_at "
            "FROM mess_users WHERE id = $1 LIMIT 1",
            {userId}
        );
        if (res.ok() && !res.empty()) {
            const auto &row = res[0];
            models::User u;
            u.id = row.get("id");
            u.email = row.get("email");
            u.passwordHash = row.get("password_hash");
            u.name = row.get("name");
            u.messId = row.get("mess_id");
            u.role = row.get("role", "admin");
            u.createdAt = row.get("created_at");
            return u;
        }
        return std::nullopt;
    }

    std::lock_guard<std::mutex> lock(mutex_);
    auto it = std::find_if(users_.begin(), users_.end(), [&](const models::User &u) { return u.id == userId; });
    if (it != users_.end()) return *it;
    return std::nullopt;
}

} // namespace repositories
} // namespace mess_manager
