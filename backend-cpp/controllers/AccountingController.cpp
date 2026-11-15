#include "AccountingController.h"
#include "../services/AccountingEngine.h"
#include "../repositories/DatabaseManager.h"
#include "../utils/DateUtils.h"
#include <drogon/drogon.h>

namespace mess_manager {
namespace controllers {

void AccountingController::optionsHandler(
    const drogon::HttpRequestPtr &/*req*/,
    std::function<void(const drogon::HttpResponsePtr &)> &&callback
) {
    auto resp = drogon::HttpResponse::newHttpResponse();
    resp->setStatusCode(drogon::k204NoContent);
    resp->addHeader("Access-Control-Allow-Origin", "*");
    resp->addHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    resp->addHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Guest-Token");
    callback(resp);
}

void AccountingController::getLedger(
    const drogon::HttpRequestPtr &req,
    std::function<void(const drogon::HttpResponsePtr &)> &&callback
) {
    std::string messId = req->getAttributes()->get<std::string>("messId");
    std::string month = req->getParameter("month");
    if (month.empty() || !utils::DateUtils::isValidMonth(month)) {
        month = utils::DateUtils::getCurrentMonth();
    }

    auto &db = repositories::DatabaseManager::instance();
    auto range = utils::DateUtils::getMonthRange(month);

    auto members = db.getMembersByMessId(messId);
    auto meals = db.getMeals(messId, range.first, range.second);
    auto expenses = db.getExpenses(messId, range.first, range.second);
    auto payments = db.getPayments(messId, range.first, range.second);

    auto summary = services::AccountingEngine::generateSummary(expenses, meals, payments, members);
    auto ledger = services::AccountingEngine::buildLedger(
        members, meals, payments, summary.mealRate, summary.householdShare
    );

    Json::Value arr(Json::arrayValue);
    for (const auto &row : ledger) arr.append(row.toJson());

    auto resp = drogon::HttpResponse::newHttpJsonResponse(arr);
    resp->addHeader("Access-Control-Allow-Origin", "*");
    callback(resp);
}

void AccountingController::getSummary(
    const drogon::HttpRequestPtr &req,
    std::function<void(const drogon::HttpResponsePtr &)> &&callback
) {
    std::string messId = req->getAttributes()->get<std::string>("messId");
    std::string month = req->getParameter("month");
    if (month.empty() || !utils::DateUtils::isValidMonth(month)) {
        month = utils::DateUtils::getCurrentMonth();
    }

    auto &db = repositories::DatabaseManager::instance();
    auto range = utils::DateUtils::getMonthRange(month);

    auto members = db.getMembersByMessId(messId);
    auto meals = db.getMeals(messId, range.first, range.second);
    auto expenses = db.getExpenses(messId, range.first, range.second);
    auto payments = db.getPayments(messId, range.first, range.second);

    auto summary = services::AccountingEngine::generateSummary(expenses, meals, payments, members);

    auto resp = drogon::HttpResponse::newHttpJsonResponse(summary.toJson());
    resp->addHeader("Access-Control-Allow-Origin", "*");
    callback(resp);
}

void AccountingController::getStatement(
    const drogon::HttpRequestPtr &req,
    std::function<void(const drogon::HttpResponsePtr &)> &&callback,
    const std::string &memberId
) {
    std::string messId = req->getAttributes()->get<std::string>("messId");
    std::string month = req->getParameter("month");
    if (month.empty() || !utils::DateUtils::isValidMonth(month)) {
        month = utils::DateUtils::getCurrentMonth();
    }

    auto &db = repositories::DatabaseManager::instance();
    auto range = utils::DateUtils::getMonthRange(month);

    auto members = db.getMembersByMessId(messId);
    auto meals = db.getMeals(messId, range.first, range.second);
    auto expenses = db.getExpenses(messId, range.first, range.second);
    auto payments = db.getPayments(messId, range.first, range.second);

    auto stmt = services::AccountingEngine::generateMemberStatement(
        memberId, members, meals, expenses, payments
    );

    auto resp = drogon::HttpResponse::newHttpJsonResponse(stmt.toJson());
    resp->addHeader("Access-Control-Allow-Origin", "*");
    callback(resp);
}

} // namespace controllers
} // namespace mess_manager
