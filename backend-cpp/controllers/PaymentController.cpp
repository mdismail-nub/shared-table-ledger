#include "PaymentController.h"
#include "../services/DomainServices.h"
#include "../utils/DateUtils.h"
#include <drogon/drogon.h>

namespace mess_manager {
namespace controllers {

void PaymentController::optionsHandler(
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

void PaymentController::getPayments(
    const drogon::HttpRequestPtr &req,
    std::function<void(const drogon::HttpResponsePtr &)> &&callback
) {
    std::string messId = req->attributes()->get<std::string>("messId");
    std::string month = req->getParameter("month");
    if (month.empty() || !utils::DateUtils::isValidMonth(month)) {
        month = utils::DateUtils::getCurrentMonth();
    }

    auto payments = services::PaymentService::getPaymentsForMonth(messId, month);
    Json::Value arr(Json::arrayValue);
    for (const auto &p : payments) arr.append(p.toJson());

    auto resp = drogon::HttpResponse::newHttpJsonResponse(arr);
    callback(resp);
}

void PaymentController::addPayment(
    const drogon::HttpRequestPtr &req,
    std::function<void(const drogon::HttpResponsePtr &)> &&callback
) {
    std::string messId = req->attributes()->get<std::string>("messId");
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
    std::string memberId = (*json)["member_id"].asString();
    double amount = (*json)["amount"].asDouble();
    std::string method = json->isMember("method") ? (*json)["method"].asString() : "Cash";
    std::string reference = json->isMember("reference") ? (*json)["reference"].asString() : "";

    auto res = services::PaymentService::recordPayment(
        messId, date, memberId, amount, method, reference
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

void PaymentController::deletePayment(
    const drogon::HttpRequestPtr &/*req*/,
    std::function<void(const drogon::HttpResponsePtr &)> &&callback,
    const std::string &id
) {
    bool ok = services::PaymentService::deletePayment(id);
    if (!ok) {
        auto resp = drogon::HttpResponse::newHttpJsonResponse(Json::Value([]() {
            Json::Value v; v["error"] = "Payment deposit not found"; return v;
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
