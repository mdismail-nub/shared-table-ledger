#pragma once

#include <string>
#include <optional>
#include <json/json.h>

namespace mess_manager {
namespace models {

struct Notification {
    std::string id;
    std::string messId;
    std::optional<std::string> senderId;
    std::optional<std::string> recipientId;
    std::string title;
    std::string message;
    std::string type{"notice"}; // "notice" | "reminder" | "alert" | "info"
    std::string createdAt;

    Json::Value toJson() const {
        Json::Value val;
        val["id"] = id;
        val["mess_id"] = messId;
        if (senderId.has_value()) {
            val["sender_id"] = *senderId;
        } else {
            val["sender_id"] = Json::Value(Json::nullValue);
        }
        if (recipientId.has_value()) {
            val["recipient_id"] = *recipientId;
        } else {
            val["recipient_id"] = Json::Value(Json::nullValue);
        }
        val["title"] = title;
        val["message"] = message;
        val["type"] = type;
        val["created_at"] = createdAt;
        return val;
    }

    static Notification fromJson(const Json::Value &val) {
        Notification n;
        if (val.isMember("id")) n.id = val["id"].asString();
        if (val.isMember("mess_id")) n.messId = val["mess_id"].asString();
        if (val.isMember("sender_id") && !val["sender_id"].isNull()) {
            n.senderId = val["sender_id"].asString();
        }
        if (val.isMember("recipient_id") && !val["recipient_id"].isNull()) {
            n.recipientId = val["recipient_id"].asString();
        }
        if (val.isMember("title")) n.title = val["title"].asString();
        if (val.isMember("message")) n.message = val["message"].asString();
        if (val.isMember("type")) n.type = val["type"].asString();
        if (val.isMember("created_at")) n.createdAt = val["created_at"].asString();
        return n;
    }
};

} // namespace models
} // namespace mess_manager
