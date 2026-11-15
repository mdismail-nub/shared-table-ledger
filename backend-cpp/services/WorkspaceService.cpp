#include "WorkspaceService.h"
#include "../repositories/DatabaseManager.h"
#include "../services/AccountingEngine.h"
#include "../utils/DateUtils.h"

namespace mess_manager {
namespace services {

std::optional<models::WorkspaceData> WorkspaceService::getWorkspace(
    const std::string &messId,
    const std::string &month,
    const std::optional<utils::JwtClaims> &auth
) {
    auto &db = repositories::DatabaseManager::instance();
    auto messOpt = db.getMessById(messId);
    if (!messOpt.has_value()) {
        return std::nullopt;
    }

    bool isAdmin = auth.has_value() && auth->role == "admin" && auth->messId == messId;
    std::optional<std::string> callerMemberId = auth ? auth->memberId : std::nullopt;

    auto range = utils::DateUtils::getMonthRange(month);
    std::string startDate = range.first;
    std::string endDate = range.second;

    auto members = db.getMembersByMessId(messId);
    auto meals = db.getMeals(messId, startDate, endDate);
    auto expenses = db.getExpenses(messId, startDate, endDate);
    auto payments = db.getPayments(messId, startDate, endDate);
    auto notifications = db.getNotifications(messId, callerMemberId, isAdmin);

    auto summary = AccountingEngine::generateSummary(expenses, meals, payments, members);
    auto ledger = AccountingEngine::buildLedger(
        members, meals, payments, summary.mealRate, summary.householdShare
    );

    models::WorkspaceData data;
    data.mess = *messOpt;
    data.members = members;
    data.isAdmin = isAdmin;
    data.meals = meals;
    data.expenses = expenses;
    // Non-admins do not receive raw member payment deposit streams directly (only their ledger share)
    data.payments = isAdmin ? payments : std::vector<models::Payment>{};
    data.summary = summary;
    data.ledger = ledger;
    data.notifications = notifications;
    if (auth.has_value()) {
        data.userId = auth->memberId.has_value() ? *auth->memberId : auth->userId;
    }

    return data;
}

std::optional<models::WorkspaceData> WorkspaceService::getWorkspaceByInviteCode(
    const std::string &inviteCode,
    const std::string &month,
    const std::optional<utils::JwtClaims> &auth
) {
    auto &db = repositories::DatabaseManager::instance();
    auto messOpt = db.getMessByInviteCode(inviteCode);
    if (!messOpt.has_value()) {
        return std::nullopt;
    }

    return getWorkspace(messOpt->id, month, auth);
}

} // namespace services
} // namespace mess_manager
