#include "AccountingEngine.h"
#include <algorithm>
#include <cmath>

namespace mess_manager {
namespace services {

double AccountingEngine::calculateMealRate(double foodTotal, double totalMeals) {
    if (totalMeals <= 0.0 || foodTotal <= 0.0) {
        return 0.0;
    }
    return foodTotal / totalMeals;
}

double AccountingEngine::calculateHouseholdShare(double householdTotal, int activeMembersCount) {
    if (activeMembersCount <= 0 || householdTotal <= 0.0) {
        return 0.0;
    }
    return householdTotal / static_cast<double>(activeMembersCount);
}

AccountingEngine::BalanceResult AccountingEngine::calculateMemberBalance(
    double deposits,
    double meals,
    double mealRate,
    double sharedShare
) {
    double mealCost = meals * mealRate;
    double due = mealCost + sharedShare;
    double balance = deposits - due;
    return { mealCost, due, balance };
}

std::vector<models::LedgerRow> AccountingEngine::buildLedger(
    const std::vector<models::Member> &members,
    const std::vector<models::Meal> &meals,
    const std::vector<models::Payment> &payments,
    double mealRate,
    double householdShare
) {
    std::vector<models::LedgerRow> ledger;
    ledger.reserve(members.size());

    for (const auto &m : members) {
        double mealCount = 0.0;
        for (const auto &meal : meals) {
            if (meal.memberId == m.id) {
                mealCount += meal.total();
            }
        }

        double paid = 0.0;
        for (const auto &p : payments) {
            if (p.memberId == m.id) {
                paid += p.amount;
            }
        }

        // Former members who have left do not pay shared utility bills
        double share = (m.status == "left") ? 0.0 : householdShare;
        auto bal = calculateMemberBalance(paid, mealCount, mealRate, share);

        models::LedgerRow row;
        row.memberId = m.id;
        row.name = m.name;
        row.status = m.status;
        row.room = m.room;
        row.tone = m.tone;
        row.meals = mealCount;
        row.mealCost = bal.mealCost;
        row.shared = share;
        row.due = bal.due;
        row.deposits = paid;
        row.balance = bal.balance;

        ledger.push_back(row);
    }

    return ledger;
}

models::Summary AccountingEngine::generateSummary(
    const std::vector<models::Expense> &expenses,
    const std::vector<models::Meal> &meals,
    const std::vector<models::Payment> &payments,
    const std::vector<models::Member> &members
) {
    models::Summary s;
    for (const auto &e : expenses) {
        if (e.type == "meal") {
            s.food += e.amount;
        } else if (e.type == "household") {
            s.household += e.amount;
        }
    }

    for (const auto &m : meals) {
        s.totalMeals += m.total();
    }

    for (const auto &p : payments) {
        s.deposits += p.amount;
    }

    int activeCount = 0;
    for (const auto &m : members) {
        if (m.status != "left") {
            activeCount++;
        }
    }
    s.activeMembers = activeCount;

    s.mealRate = calculateMealRate(s.food, s.totalMeals);
    s.householdShare = calculateHouseholdShare(s.household, s.activeMembers);

    return s;
}

MemberStatement AccountingEngine::generateMemberStatement(
    const std::string &memberId,
    const std::vector<models::Member> &members,
    const std::vector<models::Meal> &meals,
    const std::vector<models::Expense> &expenses,
    const std::vector<models::Payment> &payments
) {
    MemberStatement stmt;
    auto memIt = std::find_if(members.begin(), members.end(), [&](const models::Member &m) {
        return m.id == memberId;
    });

    if (memIt != members.end()) {
        stmt.member = *memIt;
    } else {
        stmt.member.id = memberId;
        stmt.member.name = "Unknown Member";
    }

    auto summary = generateSummary(expenses, meals, payments, members);
    stmt.mealRate = summary.mealRate;
    stmt.householdShare = summary.householdShare;

    auto ledger = buildLedger(members, meals, payments, summary.mealRate, summary.householdShare);
    auto rowIt = std::find_if(ledger.begin(), ledger.end(), [&](const models::LedgerRow &r) {
        return r.memberId == memberId;
    });

    if (rowIt != ledger.end()) {
        stmt.ledgerRow = *rowIt;
    }

    for (const auto &m : meals) {
        if (m.memberId == memberId) {
            stmt.itemizedMeals.push_back(m);
        }
    }

    for (const auto &p : payments) {
        if (p.memberId == memberId) {
            stmt.itemizedPayments.push_back(p);
        }
    }

    return stmt;
}

} // namespace services
} // namespace mess_manager
