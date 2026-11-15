#include "ExpenseController.h"
#include "../services/DomainServices.h"
#include "../utils/DateUtils.h"
#include <drogon/drogon.h>

namespace mess_manager {
namespace controllers {

void ExpenseController::optionsHandler(
    const drogon::HttpRequestPtr &/*req*/,
    std::function<void(const drogon::HttpResponsePtr &)> &&callback
) {
    auto resp = drogon::HttpResponse::newHttpResponse();
    resp->setStatusCode(drogon::k204NoContent);
    resp->addHeader("Access-Control-Allow-Origin", "*");
    resp->addHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
    resp->addHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Guest-Token");
    callback(resp);
}

void ExpenseController::getExpenses(
    const drogon::HttpRequestPtr &req,
    std::function<void(const drogon::HttpResponsePtr &)> &&callback
) {
    std::string messId = req->getAttributes()->get<std::string>("messId");
    std::string month = req->getParameter("month");
    if (month.empty() || !utils::DateUtils::isValidMonth(month)) {
        month = utils::DateUtils::getCurrentMonth();
    }

    auto expenses = services::ExpenseService::getExpensesForMonth(messId, month);
    Json::Value arr(Json::arrayValue);
    for (const auto &e : expenses) arr.append(e.toJson());

    auto resp = drogon::HttpResponse::newHttpJsonResponse(arr);
    resp->addHeader("Access-Control-Allow-Origin", "*");
    callback(resp);
}

void ExpenseController::addExpense(
    const drogon::HttpRequestPtr &req,
    std::function<void(const drogon::HttpResponsePtr &)> &&callback
) {
    std::string messId = req->getAttributes()->get<std::string>("messId");
    auto json = req->getJsonObject();
    if (!json) {
        auto resp = drogon::HttpResponse::newHttpJsonResponse(Json::Value([]() {
            Json::Value v; v["error"] = "Invalid JSON body"; return v;
        }()));
        resp->setStatusCode(drogon::k400BadRequest);
        callback(resp);
        return;
    }

    std::string date = (*json)["date"].asString();
    std::string type = (*json)["type"].asString();
    std::string category = (*json)["category"].asString();
    std::string description = json->isMember("description") ? (*json)["description"].asString() : "";
    double amount = (*json)["amount"].asDouble();
    std::string method = json->isMember("method") ? (*json)["method"].asString() : "Cash";

    std::optional<std::string> memberId;
    if (json->isMember("member_id") && !(*json)["member_id"].isNull() && !(*json)["member_id"].asString().empty()) {
        memberId = (*json)["member_id"].asString();
    }

    auto res = services::ExpenseService::addExpense(
        messId, date, type, category, description, amount, memberId, method
    );

    if (!res.first) {
        auto resp = drogon::HttpResponse::newHttpJsonResponse(Json::Value([&]() {
            Json::Value v; v["error"] = res.second; return v;
        }()));
        resp->setStatusCode(drogon::k400BadRequest);
        resp->addHeader("Access-Control-Allow-Origin", "*");
        callback(resp);
        return;
    }

    Json::Value okVal;
    okVal["success"] = true;
    okVal["id"] = res.second;
    auto resp = drogon::HttpResponse::newHttpJsonResponse(okVal);
    resp->setStatusCode(drogon::k201Created);
    resp->addHeader("Access-Control-Allow-Origin", "*");
    callback(resp);
}

void ExpenseController::deleteExpense(
    const drogon::HttpRequestPtr &/*req*/,
    std::function<void(const drogon::HttpResponsePtr &)> &&callback,
    const std::string &id
) {
    bool ok = services::ExpenseService::deleteExpense(id);
    if (!ok) {
        auto resp = drogon::HttpResponse::newHttpJsonResponse(Json::Value([]() {
            Json::Value v; v["error"] = "Expense record not found"; return v;
        }()));
        resp->setStatusCode(drogon::k404NotFound);
        resp->addHeader("Access-Control-Allow-Origin", "*");
        callback(resp);
        return;
    }

    Json::Value okVal;
    okVal["success"] = true;
    auto resp = drogon::HttpResponse::newHttpJsonResponse(okVal);
    resp->addHeader("Access-Control-Allow-Origin", "*");
    callback(resp);
}

} // namespace controllers
} // namespace mess_manager
