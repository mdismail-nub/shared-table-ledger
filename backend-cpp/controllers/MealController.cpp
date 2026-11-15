#include "MealController.h"
#include "../services/DomainServices.h"
#include "../utils/DateUtils.h"
#include <drogon/drogon.h>

namespace mess_manager {
namespace controllers {

void MealController::optionsHandler(
    const drogon::HttpRequestPtr &/*req*/,
    std::function<void(const drogon::HttpResponsePtr &)> &&callback
) {
    auto resp = drogon::HttpResponse::newHttpResponse();
    resp->setStatusCode(drogon::k204NoContent);
    resp->addHeader("Access-Control-Allow-Origin", "*");
    resp->addHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    resp->addHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Guest-Token");
    callback(resp);
}

void MealController::getMeals(
    const drogon::HttpRequestPtr &req,
    std::function<void(const drogon::HttpResponsePtr &)> &&callback
) {
    std::string messId = req->getAttributes()->get<std::string>("messId");
    std::string month = req->getParameter("month");
    if (month.empty() || !utils::DateUtils::isValidMonth(month)) {
        month = utils::DateUtils::getCurrentMonth();
    }

    auto meals = services::MealService::getMealsForMonth(messId, month);
    Json::Value arr(Json::arrayValue);
    for (const auto &m : meals) arr.append(m.toJson());

    auto resp = drogon::HttpResponse::newHttpJsonResponse(arr);
    resp->addHeader("Access-Control-Allow-Origin", "*");
    callback(resp);
}

void MealController::upsertMeals(
    const drogon::HttpRequestPtr &req,
    std::function<void(const drogon::HttpResponsePtr &)> &&callback
) {
    std::string messId = req->getAttributes()->get<std::string>("messId");
    auto json = req->getJsonObject();
    if (!json || !json->isArray()) {
        auto resp = drogon::HttpResponse::newHttpJsonResponse(Json::Value([]() {
            Json::Value v; v["error"] = "Expected an array of meal records"; return v;
        }()));
        resp->setStatusCode(drogon::k400BadRequest);
        callback(resp);
        return;
    }

    std::vector<models::Meal> mealsToSave;
    for (const auto &item : *json) {
        auto m = models::Meal::fromJson(item);
        m.messId = messId;
        mealsToSave.push_back(m);
    }

    bool ok = services::MealService::upsertDailyMeals(mealsToSave);
    if (!ok) {
        auto resp = drogon::HttpResponse::newHttpJsonResponse(Json::Value([]() {
            Json::Value v; v["error"] = "Invalid meal numbers (meals must be between 0 and 10 per slot)"; return v;
        }()));
        resp->setStatusCode(drogon::k400BadRequest);
        resp->addHeader("Access-Control-Allow-Origin", "*");
        callback(resp);
        return;
    }

    Json::Value okVal;
    okVal["success"] = true;
    okVal["count"] = static_cast<Json::UInt64>(mealsToSave.size());
    auto resp = drogon::HttpResponse::newHttpJsonResponse(okVal);
    resp->addHeader("Access-Control-Allow-Origin", "*");
    callback(resp);
}

} // namespace controllers
} // namespace mess_manager
