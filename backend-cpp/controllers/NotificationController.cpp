#include "NotificationController.h"
#include "../services/DomainServices.h"
#include "../repositories/DatabaseManager.h"
#include <drogon/drogon.h>

namespace mess_manager {
namespace controllers {

void NotificationController::optionsHandler(
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

void NotificationController::getNotifications(
    const drogon::HttpRequestPtr &req,
    std::function<void(const drogon::HttpResponsePtr &)> &&callback
) {
    std::string messId = req->attributes()->get<std::string>("messId");
    std::string role = req->attributes()->get<std::string>("role");
    bool isAdmin = (role == "admin");

    std::optional<std::string> memberId;
    if (req->attributes()->find("memberId")) {
        memberId = req->attributes()->get<std::string>("memberId");
    }

    auto notifs = repositories::DatabaseManager::instance().getNotifications(messId, memberId, isAdmin);
    Json::Value arr(Json::arrayValue);
    for (const auto &n : notifs) arr.append(n.toJson());

    auto resp = drogon::HttpResponse::newHttpJsonResponse(arr);
    callback(resp);
}

void NotificationController::sendNotification(
    const drogon::HttpRequestPtr &req,
    std::function<void(const drogon::HttpResponsePtr &)> &&callback
) {
    std::string messId = req->attributes()->get<std::string>("messId");
    std::string role = req->attributes()->get<std::string>("role");
    bool isAdmin = (role == "admin");

    auto json = req->getJsonObject();
    if (!json) {
        auto resp = drogon::HttpResponse::newHttpJsonResponse(Json::Value([]() {
            Json::Value v; v["error"] = "Invalid JSON body"; return v;
        }()));
        resp->setStatusCode(drogon::k400BadRequest);
        callback(resp);
        return;
    }

    std::string title = (*json)["title"].asString();
    std::string message = (*json)["message"].asString();
    std::string type = json->isMember("type") ? (*json)["type"].asString() : "notice";

    std::optional<std::string> senderId;
    if (req->attributes()->find("memberId")) {
        senderId = req->attributes()->get<std::string>("memberId");
    }

    std::optional<std::string> recipientId;
    if (json->isMember("recipient_id") && !(*json)["recipient_id"].isNull() && !(*json)["recipient_id"].asString().empty()) {
        recipientId = (*json)["recipient_id"].asString();
    }

    // Role verification: Non-admins cannot send broadcast messages to all members
    if (!isAdmin) {
        if (!recipientId.has_value() || recipientId->empty()) {
            auto resp = drogon::HttpResponse::newHttpJsonResponse(Json::Value([]() {
                Json::Value v; v["error"] = "Forbidden: Members can only send direct messages to the mess manager."; return v;
            }()));
            resp->setStatusCode(drogon::k403Forbidden);
            resp->addHeader("Access-Control-Allow-Origin", "*");
            callback(resp);
            return;
        }
    }

    auto res = services::NotificationService::sendNotification(
        messId, senderId, recipientId, title, message, type
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

void NotificationController::deleteNotification(
    const drogon::HttpRequestPtr &/*req*/,
    std::function<void(const drogon::HttpResponsePtr &)> &&callback,
    const std::string &id
) {
    bool ok = services::NotificationService::deleteNotification(id);
    if (!ok) {
        auto resp = drogon::HttpResponse::newHttpJsonResponse(Json::Value([]() {
            Json::Value v; v["error"] = "Notification not found"; return v;
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
