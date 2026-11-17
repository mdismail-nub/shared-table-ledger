#include "SettingsController.h"
#include "../repositories/DatabaseManager.h"
#include "../utils/Crypto.h"
#include "../validators/InputValidator.h"
#include <drogon/drogon.h>

namespace mess_manager {
namespace controllers {

void SettingsController::optionsHandler(
    const drogon::HttpRequestPtr &/*req*/,
    std::function<void(const drogon::HttpResponsePtr &)> &&callback
) {
    auto resp = drogon::HttpResponse::newHttpResponse();
    resp->setStatusCode(drogon::k204NoContent);
    resp->addHeader("Access-Control-Allow-Origin", "*");
    resp->addHeader("Access-Control-Allow-Methods", "PUT, POST, OPTIONS");
    resp->addHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Guest-Token");
    callback(resp);
}

void SettingsController::updateSettings(
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

    auto &db = repositories::DatabaseManager::instance();
    auto messOpt = db.getMessById(messId);
    if (!messOpt.has_value()) {
        auto resp = drogon::HttpResponse::newHttpJsonResponse(Json::Value([]() {
            Json::Value v; v["error"] = "Mess record not found"; return v;
        }()));
        resp->setStatusCode(drogon::k404NotFound);
        callback(resp);
        return;
    }

    auto mess = *messOpt;
    if (json->isMember("name")) {
        std::string name = (*json)["name"].asString();
        auto err = validators::InputValidator::validateMessName(name);
        if (err.has_value()) {
            auto resp = drogon::HttpResponse::newHttpJsonResponse(Json::Value([&]() {
                Json::Value v; v["error"] = *err; return v;
            }()));
            resp->setStatusCode(drogon::k400BadRequest);
            callback(resp);
            return;
        }
        mess.name = name;
    }

    if (json->isMember("manager")) {
        std::string manager = (*json)["manager"].asString();
        auto err = validators::InputValidator::validateManagerName(manager);
        if (err.has_value()) {
            auto resp = drogon::HttpResponse::newHttpJsonResponse(Json::Value([&]() {
                Json::Value v; v["error"] = *err; return v;
            }()));
            resp->setStatusCode(drogon::k400BadRequest);
            callback(resp);
            return;
        }
        mess.manager = manager;
    }

    if (json->isMember("address")) {
        mess.address = (*json)["address"].asString().substr(0, 200);
    }

    if (json->isMember("show_invite_to_members")) {
        mess.showInviteToMembers = (*json)["show_invite_to_members"].asBool();
    }

    if (json->isMember("meal_categories") && (*json)["meal_categories"].isArray()) {
        mess.mealCategories.clear();
        for (const auto &cat : (*json)["meal_categories"]) {
            mess.mealCategories.push_back(cat.asString());
        }
    }

    if (json->isMember("household_categories") && (*json)["household_categories"].isArray()) {
        mess.householdCategories.clear();
        for (const auto &cat : (*json)["household_categories"]) {
            mess.householdCategories.push_back(cat.asString());
        }
    }

    bool ok = db.updateMess(mess);
    if (!ok) {
        auto resp = drogon::HttpResponse::newHttpJsonResponse(Json::Value([]() {
            Json::Value v; v["error"] = "Failed to update mess settings"; return v;
        }()));
        resp->setStatusCode(drogon::k500InternalServerError);
        callback(resp);
        return;
    }

    Json::Value okVal;
    okVal["success"] = true;
    auto resp = drogon::HttpResponse::newHttpJsonResponse(okVal);
    resp->addHeader("Access-Control-Allow-Origin", "*");
    callback(resp);
}

void SettingsController::regenerateCode(
    const drogon::HttpRequestPtr &req,
    std::function<void(const drogon::HttpResponsePtr &)> &&callback
) {
    std::string messId = req->attributes()->get<std::string>("messId");
    std::string newCode = utils::Crypto::generateInviteCode();

    bool ok = repositories::DatabaseManager::instance().regenerateInviteCode(messId, newCode);
    if (!ok) {
        auto resp = drogon::HttpResponse::newHttpJsonResponse(Json::Value([]() {
            Json::Value v; v["error"] = "Failed to regenerate invite code"; return v;
        }()));
        resp->setStatusCode(drogon::k500InternalServerError);
        callback(resp);
        return;
    }

    Json::Value okVal;
    okVal["success"] = true;
    okVal["code"] = newCode;
    auto resp = drogon::HttpResponse::newHttpJsonResponse(okVal);
    callback(resp);
}

} // namespace controllers
} // namespace mess_manager
