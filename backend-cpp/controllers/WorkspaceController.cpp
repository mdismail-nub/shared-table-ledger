#include "WorkspaceController.h"
#include "../services/WorkspaceService.h"
#include "../services/AuthService.h"
#include "../repositories/DatabaseManager.h"
#include "../utils/DateUtils.h"
#include "../validators/InputValidator.h"
#include <drogon/drogon.h>

namespace mess_manager {
extern services::AuthService *g_authService;

namespace controllers {

void WorkspaceController::optionsHandler(
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

void WorkspaceController::getWorkspace(
    const drogon::HttpRequestPtr &req,
    std::function<void(const drogon::HttpResponsePtr &)> &&callback
) {
    std::string messId = req->attributes()->get<std::string>("messId");
    std::string month = req->getParameter("month");
    if (month.empty() || !utils::DateUtils::isValidMonth(month)) {
        month = utils::DateUtils::getCurrentMonth();
    }

    auto claims = req->attributes()->get<utils::JwtClaims>("claims");
    auto wsOpt = services::WorkspaceService::getWorkspace(messId, month, claims);

    if (!wsOpt.has_value()) {
        auto resp = drogon::HttpResponse::newHttpJsonResponse(Json::Value([]() {
            Json::Value v; v["error"] = "Workspace not found"; return v;
        }()));
        resp->setStatusCode(drogon::k404NotFound);
        callback(resp);
        return;
    }

    auto resp = drogon::HttpResponse::newHttpJsonResponse(wsOpt->toJson());
    callback(resp);
}

void WorkspaceController::getWorkspaceByCode(
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
    std::string month = (*json)["month"].asString();
    if (month.empty() || !utils::DateUtils::isValidMonth(month)) {
        month = utils::DateUtils::getCurrentMonth();
    }

    std::optional<utils::JwtClaims> authClaims;
    if (json->isMember("token") && !(*json)["token"].isNull() && g_authService) {
        authClaims = g_authService->verifyAuth((*json)["token"].asString());
    }

    auto wsOpt = services::WorkspaceService::getWorkspaceByInviteCode(code, month, authClaims);
    if (!wsOpt.has_value()) {
        auto resp = drogon::HttpResponse::newHttpJsonResponse(Json::Value([]() {
            Json::Value v; v["error"] = "Mess not found with provided code"; return v;
        }()));
        resp->setStatusCode(drogon::k404NotFound);
        resp->addHeader("Access-Control-Allow-Origin", "*");
        callback(resp);
        return;
    }

    auto resp = drogon::HttpResponse::newHttpJsonResponse(wsOpt->toJson());
    resp->addHeader("Access-Control-Allow-Origin", "*");
    callback(resp);
}

void WorkspaceController::previewMessByCode(
    const drogon::HttpRequestPtr &/*req*/,
    std::function<void(const drogon::HttpResponsePtr &)> &&callback,
    const std::string &code
) {
    auto codeErr = validators::InputValidator::validateInviteCode(code);
    if (codeErr.has_value()) {
        auto resp = drogon::HttpResponse::newHttpJsonResponse(Json::Value([&]() {
            Json::Value v; v["error"] = *codeErr; return v;
        }()));
        resp->setStatusCode(drogon::k400BadRequest);
        resp->addHeader("Access-Control-Allow-Origin", "*");
        callback(resp);
        return;
    }

    auto &db = repositories::DatabaseManager::instance();
    auto messOpt = db.getMessByInviteCode(code);
    if (!messOpt.has_value()) {
        auto resp = drogon::HttpResponse::newHttpJsonResponse(Json::Value([]() {
            Json::Value v; v["error"] = "No mess found with that invitation code."; return v;
        }()));
        resp->setStatusCode(drogon::k404NotFound);
        resp->addHeader("Access-Control-Allow-Origin", "*");
        callback(resp);
        return;
    }

    auto members = db.getMembersByMessId(messOpt->id);
    Json::Value result;
    result["id"] = messOpt->id;
    result["name"] = messOpt->name;
    result["manager"] = messOpt->manager;
    result["address"] = messOpt->address;
    result["currency"] = messOpt->currency;

    Json::Value membersArray(Json::arrayValue);
    for (const auto &m : members) {
        if (m.status != "left") {
            // Public sanitized profile: id, name, room, tone, role, status (NEVER phone or user_id)
            Json::Value memVal;
            memVal["id"] = m.id;
            memVal["name"] = m.name;
            memVal["room"] = m.room;
            memVal["tone"] = m.tone;
            memVal["role"] = m.role;
            memVal["status"] = m.status;
            membersArray.append(memVal);
        }
    }
    result["members"] = membersArray;

    auto resp = drogon::HttpResponse::newHttpJsonResponse(result);
    resp->addHeader("Access-Control-Allow-Origin", "*");
    callback(resp);
}

} // namespace controllers
} // namespace mess_manager
