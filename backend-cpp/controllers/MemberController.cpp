#include "MemberController.h"
#include "../services/DomainServices.h"
#include <drogon/drogon.h>

namespace mess_manager {
namespace controllers {

void MemberController::optionsHandler(
    const drogon::HttpRequestPtr &/*req*/,
    std::function<void(const drogon::HttpResponsePtr &)> &&callback
) {
    auto resp = drogon::HttpResponse::newHttpResponse();
    resp->setStatusCode(drogon::k204NoContent);
    resp->addHeader("Access-Control-Allow-Origin", "*");
    resp->addHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    resp->addHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Guest-Token");
    callback(resp);
}

void MemberController::getMembers(
    const drogon::HttpRequestPtr &req,
    std::function<void(const drogon::HttpResponsePtr &)> &&callback
) {
    std::string messId = req->attributes()->get<std::string>("messId");
    std::string role = req->attributes()->get<std::string>("role");
    bool isAdmin = (role == "admin");

    auto members = services::MemberService::getMembers(messId);
    Json::Value arr(Json::arrayValue);
    for (const auto &m : members) {
        arr.append(m.toJson(isAdmin));
    }

    auto resp = drogon::HttpResponse::newHttpJsonResponse(arr);
    callback(resp);
}

void MemberController::addMember(
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

    std::string name = (*json)["name"].asString();
    std::string phone = json->isMember("phone") ? (*json)["phone"].asString() : "";
    std::string room = json->isMember("room") ? (*json)["room"].asString() : "";

    auto res = services::MemberService::addMember(messId, name, phone, room);
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

void MemberController::updateStatus(
    const drogon::HttpRequestPtr &req,
    std::function<void(const drogon::HttpResponsePtr &)> &&callback,
    const std::string &id
) {
    auto json = req->getJsonObject();
    if (!json || !json->isMember("status")) {
        auto resp = drogon::HttpResponse::newHttpJsonResponse(Json::Value([]() {
            Json::Value v; v["error"] = "Status field is required"; return v;
        }()));
        resp->setStatusCode(drogon::k400BadRequest);
        callback(resp);
        return;
    }

    std::string status = (*json)["status"].asString();
    bool ok = services::MemberService::updateStatus(id, status);
    if (!ok) {
        auto resp = drogon::HttpResponse::newHttpJsonResponse(Json::Value([]() {
            Json::Value v; v["error"] = "Member not found"; return v;
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

void MemberController::deleteMember(
    const drogon::HttpRequestPtr &/*req*/,
    std::function<void(const drogon::HttpResponsePtr &)> &&callback,
    const std::string &id
) {
    bool ok = services::MemberService::deleteMember(id);
    if (!ok) {
        auto resp = drogon::HttpResponse::newHttpJsonResponse(Json::Value([]() {
            Json::Value v; v["error"] = "Member not found"; return v;
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
