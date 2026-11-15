#pragma once

#include <string>
#include <optional>
#include <cstdint>
#include <json/json.h>

namespace mess_manager {
namespace models {

struct GuestSession {
    std::string id;
    std::string token;
    std::string messId;
    std::optional<std::string> memberId;
    std::string role{"guest"}; // "guest" | "member"
    int64_t expiresAt{0};
    bool revoked{false};
    std::string createdAt;

    bool isExpired(int64_t now) const {
        return revoked || (expiresAt > 0 && expiresAt < now);
    }

    Json::Value toJson() const {
        Json::Value val;
        val["id"] = id;
        val["token"] = token;
        val["mess_id"] = messId;
        if (memberId.has_value()) {
            val["member_id"] = *memberId;
        } else {
            val["member_id"] = Json::Value(Json::nullValue);
        }
        val["role"] = role;
        val["expires_at"] = static_cast<Json::Int64>(expiresAt);
        val["revoked"] = revoked;
        val["created_at"] = createdAt;
        return val;
    }

    static GuestSession fromJson(const Json::Value &val) {
        GuestSession s;
        if (val.isMember("id")) s.id = val["id"].asString();
        if (val.isMember("token")) s.token = val["token"].asString();
        if (val.isMember("mess_id")) s.messId = val["mess_id"].asString();
        if (val.isMember("member_id") && !val["member_id"].isNull()) {
            s.memberId = val["member_id"].asString();
        }
        if (val.isMember("role")) s.role = val["role"].asString();
        if (val.isMember("expires_at")) s.expiresAt = val["expires_at"].asInt64();
        if (val.isMember("revoked")) s.revoked = val["revoked"].asBool();
        if (val.isMember("created_at")) s.createdAt = val["created_at"].asString();
        return s;
    }
};

} // namespace models
} // namespace mess_manager
