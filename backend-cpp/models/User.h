#pragma once

#include <string>
#include <json/json.h>

namespace mess_manager {
namespace models {

struct User {
    std::string id;
    std::string email;
    std::string passwordHash;
    std::string name;
    std::string messId;
    std::string role{"admin"};
    std::string createdAt;

    Json::Value toJson(bool includeHash = false) const {
        Json::Value val;
        val["id"] = id;
        val["email"] = email;
        if (includeHash) {
            val["password_hash"] = passwordHash;
        }
        val["name"] = name;
        val["mess_id"] = messId;
        val["role"] = role;
        val["created_at"] = createdAt;
        return val;
    }

    static User fromJson(const Json::Value &val) {
        User u;
        if (val.isMember("id")) u.id = val["id"].asString();
        if (val.isMember("email")) u.email = val["email"].asString();
        if (val.isMember("password_hash")) u.passwordHash = val["password_hash"].asString();
        if (val.isMember("name")) u.name = val["name"].asString();
        if (val.isMember("mess_id")) u.messId = val["mess_id"].asString();
        if (val.isMember("role")) u.role = val["role"].asString();
        if (val.isMember("created_at")) u.createdAt = val["created_at"].asString();
        return u;
    }
};

struct AuthSession {
    std::string userId;
    std::string email;
    std::string name;
    std::string messId;
    std::string role; // "admin" | "member" | "guest"
    std::optional<std::string> memberId;
    std::string token;
    std::string inviteCode;
    std::string createdAt;

    Json::Value toJson() const {
        Json::Value val;
        val["userId"] = userId;
        val["email"] = email;
        val["name"] = name;
        val["messId"] = messId;
        val["role"] = role;
        if (memberId.has_value()) {
            val["memberId"] = *memberId;
        } else {
            val["memberId"] = Json::Value(Json::nullValue);
        }
        val["token"] = token;
        val["inviteCode"] = inviteCode;
        val["createdAt"] = createdAt;
        return val;
    }
};

} // namespace models
} // namespace mess_manager
