#include "AuthController.h"
#include "../services/AuthService.h"
#include "../repositories/DatabaseManager.h"
#include "../validators/InputValidator.h"
#include <drogon/drogon.h>

namespace mess_manager {

services::AuthService *g_authService = nullptr;

namespace controllers {

void AuthController::optionsHandler(
    const drogon::HttpRequestPtr &/*req*/,
    std::function<void(const drogon::HttpResponsePtr &)> &&callback
) {
    auto resp = drogon::HttpResponse::newHttpResponse();
    resp->setStatusCode(drogon::k204NoContent);
    resp->addHeader("Access-Control-Allow-Origin", "*");
    resp->addHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    resp->addHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Guest-Token");
    callback(resp);
}

void AuthController::registerAdmin(
    const drogon::HttpRequestPtr &req,
    std::function<void(const drogon::HttpResponsePtr &)> &&callback
) {
    auto json = req->getJsonObject();
    if (!json) {
        auto resp = drogon::HttpResponse::newHttpJsonResponse(Json::Value([]() {
            Json::Value v; v["error"] = "Invalid JSON body"; return v;
        }()));
        resp->setStatusCode(drogon::k400BadRequest);
        callback(resp);
        return;
    }

    std::string email = (*json)["email"].asString();
    std::string password = (*json)["password"].asString();
    std::string name = (*json)["name"].asString();
    std::string messName = (*json)["messName"].asString();
    std::string currency = (*json)["currency"].asString();

    if (email.empty() || password.empty() || name.empty()) {
        auto resp = drogon::HttpResponse::newHttpJsonResponse(Json::Value([]() {
            Json::Value v; v["error"] = "Please fill in all required fields"; return v;
        }()));
        resp->setStatusCode(drogon::k400BadRequest);
        callback(resp);
        return;
    }

    if (!g_authService) {
        auto resp = drogon::HttpResponse::newHttpJsonResponse(Json::Value([]() {
            Json::Value v; v["error"] = "Auth service not initialized"; return v;
        }()));
        resp->setStatusCode(drogon::k500InternalServerError);
        callback(resp);
        return;
    }

    auto res = g_authService->registerAdmin(email, password, name, messName, currency);
    if (!res.first) {
        auto resp = drogon::HttpResponse::newHttpJsonResponse(Json::Value([&]() {
            Json::Value v; v["error"] = res.second; return v;
        }()));
        resp->setStatusCode(drogon::k400BadRequest);
        callback(resp);
        return;
    }

    // Auto-login registered admin
    auto sessionOpt = g_authService->loginAdmin(email, password);
    if (sessionOpt.has_value()) {
        auto resp = drogon::HttpResponse::newHttpJsonResponse(sessionOpt->toJson());
        resp->addHeader("Access-Control-Allow-Origin", "*");
        callback(resp);
        return;
    }

    Json::Value successVal;
    successVal["success"] = true;
    successVal["userId"] = res.second;
    auto resp = drogon::HttpResponse::newHttpJsonResponse(successVal);
    resp->addHeader("Access-Control-Allow-Origin", "*");
    callback(resp);
}

void AuthController::login(
    const drogon::HttpRequestPtr &req,
    std::function<void(const drogon::HttpResponsePtr &)> &&callback
) {
    auto json = req->getJsonObject();
    if (!json) {
        auto resp = drogon::HttpResponse::newHttpJsonResponse(Json::Value([]() {
            Json::Value v; v["error"] = "Invalid JSON body"; return v;
        }()));
        resp->setStatusCode(drogon::k400BadRequest);
        callback(resp);
        return;
    }

    std::string email = (*json)["email"].asString();
    std::string password = (*json)["password"].asString();

    if (email.empty() || password.empty()) {
        auto resp = drogon::HttpResponse::newHttpJsonResponse(Json::Value([]() {
            Json::Value v; v["error"] = "Please provide email and password"; return v;
        }()));
        resp->setStatusCode(drogon::k400BadRequest);
        callback(resp);
        return;
    }

    if (!g_authService) {
        auto resp = drogon::HttpResponse::newHttpJsonResponse(Json::Value([]() {
            Json::Value v; v["error"] = "Auth service not initialized"; return v;
        }()));
        resp->setStatusCode(drogon::k500InternalServerError);
        callback(resp);
        return;
    }

    auto sessionOpt = g_authService->loginAdmin(email, password);
    if (!sessionOpt.has_value()) {
        auto resp = drogon::HttpResponse::newHttpJsonResponse(Json::Value([]() {
            Json::Value v; v["error"] = "Invalid email or password"; return v;
        }()));
        resp->setStatusCode(drogon::k401Unauthorized);
        resp->addHeader("Access-Control-Allow-Origin", "*");
        callback(resp);
        return;
    }

    auto resp = drogon::HttpResponse::newHttpJsonResponse(sessionOpt->toJson());
    resp->addHeader("Access-Control-Allow-Origin", "*");
    callback(resp);
}

void AuthController::createGuestSession(
    const drogon::HttpRequestPtr &req,
    std::function<void(const drogon::HttpResponsePtr &)> &&callback
) {
    auto json = req->getJsonObject();
    if (!json) {
        auto resp = drogon::HttpResponse::newHttpJsonResponse(Json::Value([]() {
            Json::Value v; v["error"] = "Invalid JSON body"; return v;
        }()));
        resp->setStatusCode(drogon::k400BadRequest);
        callback(resp);
        return;
    }

    std::string code = (*json)["code"].asString();
    std::optional<std::string> memberId;
    if (json->isMember("memberId") && !(*json)["memberId"].isNull() && (*json)["memberId"].asString() != "new") {
        memberId = (*json)["memberId"].asString();
    }

    auto codeErr = validators::InputValidator::validateInviteCode(code);
    if (codeErr.has_value()) {
        auto resp = drogon::HttpResponse::newHttpJsonResponse(Json::Value([&]() {
            Json::Value v; v["error"] = *codeErr; return v;
        }()));
        resp->setStatusCode(drogon::k400BadRequest);
        callback(resp);
        return;
    }

    if (!g_authService) {
        auto resp = drogon::HttpResponse::newHttpJsonResponse(Json::Value([]() {
            Json::Value v; v["error"] = "Auth service not initialized"; return v;
        }()));
        resp->setStatusCode(drogon::k500InternalServerError);
        callback(resp);
        return;
    }

    auto sessionOpt = g_authService->createGuestSession(code, memberId);
    if (!sessionOpt.has_value()) {
        auto resp = drogon::HttpResponse::newHttpJsonResponse(Json::Value([]() {
            Json::Value v; v["error"] = "Invalid invitation code"; return v;
        }()));
        resp->setStatusCode(drogon::k404NotFound);
        resp->addHeader("Access-Control-Allow-Origin", "*");
        callback(resp);
        return;
    }

    auto resp = drogon::HttpResponse::newHttpJsonResponse(sessionOpt->toJson());
    callback(resp);
}

void AuthController::me(
    const drogon::HttpRequestPtr &req,
    std::function<void(const drogon::HttpResponsePtr &)> &&callback
) {
    std::string userId = req->attributes()->get<std::string>("userId");
    std::string role = req->attributes()->get<std::string>("role");
    std::string messId = req->attributes()->get<std::string>("messId");
    std::optional<std::string> memberId;
    if (req->attributes()->find("memberId")) {
        memberId = req->attributes()->get<std::string>("memberId");
    }

    auto &db = repositories::DatabaseManager::instance();
    auto userOpt = db.getUserById(userId);

    Json::Value root;
    root["id"] = userId;
    root["role"] = role;
    root["mess_id"] = messId;
    if (memberId.has_value()) {
        root["member_id"] = *memberId;
    }
    if (userOpt.has_value()) {
        root["email"] = userOpt->email;
        root["name"] = userOpt->name;
    }

    auto resp = drogon::HttpResponse::newHttpJsonResponse(root);
    callback(resp);
}

} // namespace controllers
} // namespace mess_manager
