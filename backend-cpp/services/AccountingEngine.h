#pragma once

#include <vector>
#include <string>
#include "../models/Member.h"
#include "../models/Meal.h"
#include "../models/Expense.h"
#include "../models/Payment.h"
#include "../models/AccountingModels.h"

namespace mess_manager {
namespace services {

struct MemberStatement {
    models::Member member;
    models::LedgerRow ledgerRow;
    std::vector<models::Meal> itemizedMeals;
    std::vector<models::Payment> itemizedPayments;
    double mealRate{0.0};
    double householdShare{0.0};

    Json::Value toJson() const {
        Json::Value val;
        val["member"] = member.toJson();
        val["ledger"] = ledgerRow.toJson();
        val["meal_rate"] = mealRate;
        val["household_share"] = householdShare;

        Json::Value mealsArray(Json::arrayValue);
        for (const auto &m : itemizedMeals) mealsArray.append(m.toJson());
        val["meals"] = mealsArray;

        Json::Value paymentsArray(Json::arrayValue);
        for (const auto &p : itemizedPayments) paymentsArray.append(p.toJson());
        val["payments"] = paymentsArray;

        return val;
    }
};

class AccountingEngine {
public:
    // Calculates monthly meal rate: foodTotal / totalMeals (returns 0 if totalMeals <= 0)
    static double calculateMealRate(double foodTotal, double totalMeals);

    // Calculates individual member household share: householdTotal / activeMembers
    static double calculateHouseholdShare(double householdTotal, int activeMembersCount);

    // Calculates individual member balances: { mealCost, due, balance }
    struct BalanceResult {
        double mealCost{0.0};
        double due{0.0};
        double balance{0.0};
    };
    static BalanceResult calculateMemberBalance(
        double deposits,
        double meals,
        double mealRate,
        double sharedShare
    );

    // Generates the comprehensive monthly settlement ledger
    static std::vector<models::LedgerRow> buildLedger(
        const std::vector<models::Member> &members,
        const std::vector<models::Meal> &meals,
        const std::vector<models::Payment> &payments,
        double mealRate,
        double householdShare
    );

    // Aggregates expenses and meals into a monthly Summary
    static models::Summary generateSummary(
        const std::vector<models::Expense> &expenses,
        const std::vector<models::Meal> &meals,
        const std::vector<models::Payment> &payments,
        const std::vector<models::Member> &members
    );

    // Generates an itemized individual financial statement for a specific member
    static MemberStatement generateMemberStatement(
        const std::string &memberId,
        const std::vector<models::Member> &members,
        const std::vector<models::Meal> &meals,
        const std::vector<models::Expense> &expenses,
        const std::vector<models::Payment> &payments
    );
};

} // namespace services
} // namespace mess_manager
