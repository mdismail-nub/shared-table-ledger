#pragma once

#include <string>
#include <optional>
#include <json/json.h>

namespace mess_manager {
namespace models {

struct Member {
    std::string id;
    std::string messId;
    std::optional<std::string> userId;
    std::string role{"member"}; // "admin" | "member"
    std::string name;
    std::string phone;
    std::string room;
    std::string joined;
    std::string status{"active"}; // "active" | "new" | "left"
    std::string tone{"primary"};
    std::string createdAt;

    Json::Value toJson(bool includePrivate = true) const {
        Json::Value val;
        val["id"] = id;
        val["mess_id"] = messId;
        if (userId.has_value()) {
            val["user_id"] = includePrivate ? *userId : Json::Value(Json::nullValue);
        } else {
            val["user_id"] = Json::Value(Json::nullValue);
        }
        val["role"] = role;
        val["name"] = name;
        val["phone"] = includePrivate ? phone : "";
        val["room"] = room;
        val["joined"] = joined;
        val["status"] = status;
        val["tone"] = tone;
        val["created_at"] = createdAt;
        return val;
    }

    static Member fromJson(const Json::Value &val) {
        Member m;
        if (val.isMember("id")) m.id = val["id"].asString();
        if (val.isMember("mess_id")) m.messId = val["mess_id"].asString();
        if (val.isMember("user_id") && !val["user_id"].isNull()) {
            m.userId = val["user_id"].asString();
        }
        if (val.isMember("role")) m.role = val["role"].asString();
        if (val.isMember("name")) m.name = val["name"].asString();
        if (val.isMember("phone")) m.phone = val["phone"].asString();
        if (val.isMember("room")) m.room = val["room"].asString();
        if (val.isMember("joined")) m.joined = val["joined"].asString();
        if (val.isMember("status")) m.status = val["status"].asString();
        if (val.isMember("tone")) m.tone = val["tone"].asString();
        if (val.isMember("created_at")) m.createdAt = val["created_at"].asString();
        return m;
    }
};

} // namespace models
} // namespace mess_manager
