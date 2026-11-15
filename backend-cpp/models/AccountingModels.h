#pragma once

#include <string>
#include <vector>
#include <optional>
#include <json/json.h>
#include "Mess.h"
#include "Member.h"
#include "Meal.h"
#include "Expense.h"
#include "Payment.h"
#include "Notification.h"

namespace mess_manager {
namespace models {

struct Summary {
    double food{0.0};
    double household{0.0};
    double totalMeals{0.0};
    double deposits{0.0};
    int activeMembers{0};
    double mealRate{0.0};
    double householdShare{0.0};

    Json::Value toJson() const {
        Json::Value val;
        val["food"] = food;
        val["household"] = household;
        val["total_meals"] = totalMeals;
        val["deposits"] = deposits;
        val["active_members"] = activeMembers;
        val["meal_rate"] = mealRate;
        val["household_share"] = householdShare;
        return val;
    }
};

struct LedgerRow {
    std::string memberId;
    std::string name;
    std::string status{"active"}; // "active" | "new" | "left"
    std::string room;
    std::string tone{"primary"};
    double meals{0.0};
    double mealCost{0.0};
    double shared{0.0};
    double due{0.0};
    double deposits{0.0};
    double balance{0.0};

    Json::Value toJson() const {
        Json::Value val;
        val["id"] = memberId;
        val["name"] = name;
        val["status"] = status;
        val["room"] = room;
        val["tone"] = tone;
        val["meals"] = meals;
        val["mealCost"] = mealCost;
        val["shared"] = shared;
        val["due"] = due;
        val["deposits"] = deposits;
        val["balance"] = balance;
        return val;
    }
};

struct WorkspaceData {
    Mess mess;
    std::vector<Member> members;
    bool isAdmin{false};
    std::vector<Meal> meals;
    std::vector<Expense> expenses;
    std::vector<Payment> payments;
    Summary summary;
    std::vector<LedgerRow> ledger;
    std::vector<Notification> notifications;
    std::optional<std::string> userId;

    Json::Value toJson() const {
        Json::Value val;
        val["mess"] = mess.toJson(isAdmin);

        Json::Value membersArray(Json::arrayValue);
        for (const auto &m : members) {
            membersArray.append(m.toJson(isAdmin));
        }
        val["members"] = membersArray;

        val["isAdmin"] = isAdmin;

        Json::Value mealsArray(Json::arrayValue);
        for (const auto &meal : meals) {
            mealsArray.append(meal.toJson());
        }
        val["meals"] = mealsArray;

        Json::Value expensesArray(Json::arrayValue);
        for (const auto &exp : expenses) {
            expensesArray.append(exp.toJson());
        }
        val["expenses"] = expensesArray;

        Json::Value paymentsArray(Json::arrayValue);
        for (const auto &p : payments) {
            paymentsArray.append(p.toJson());
        }
        val["payments"] = paymentsArray;

        val["summary"] = summary.toJson();

        Json::Value ledgerArray(Json::arrayValue);
        for (const auto &row : ledger) {
            ledgerArray.append(row.toJson());
        }
        val["ledger"] = ledgerArray;

        Json::Value notifsArray(Json::arrayValue);
        for (const auto &n : notifications) {
            notifsArray.append(n.toJson());
        }
        val["notifications"] = notifsArray;

        if (userId.has_value()) {
            val["userId"] = *userId;
        } else {
            val["userId"] = Json::Value(Json::nullValue);
        }

        return val;
    }
};

} // namespace models
} // namespace mess_manager
