#pragma once

#include <string>
#include <optional>
#include <json/json.h>

namespace mess_manager {
namespace models {

struct Expense {
    std::string id;
    std::string messId;
    std::string date; // "YYYY-MM-DD"
    std::string type{"meal"}; // "meal" | "household"
    std::string category;
    std::string description;
    double amount{0.0};
    std::optional<std::string> memberId;
    std::string method{"Cash"};
    std::string createdAt;

    Json::Value toJson() const {
        Json::Value val;
        val["id"] = id;
        val["mess_id"] = messId;
        val["date"] = date;
        val["type"] = type;
        val["category"] = category;
        val["description"] = description;
        val["amount"] = amount;
        if (memberId.has_value()) {
            val["member_id"] = *memberId;
        } else {
            val["member_id"] = Json::Value(Json::nullValue);
        }
        val["method"] = method;
        val["created_at"] = createdAt;
        return val;
    }

    static Expense fromJson(const Json::Value &val) {
        Expense e;
        if (val.isMember("id")) e.id = val["id"].asString();
        if (val.isMember("mess_id")) e.messId = val["mess_id"].asString();
        if (val.isMember("date")) e.date = val["date"].asString();
        if (val.isMember("type")) e.type = val["type"].asString();
        if (val.isMember("category")) e.category = val["category"].asString();
        if (val.isMember("description")) e.description = val["description"].asString();
        if (val.isMember("amount")) e.amount = val["amount"].asDouble();
        if (val.isMember("member_id") && !val["member_id"].isNull()) {
            e.memberId = val["member_id"].asString();
        }
        if (val.isMember("method")) e.method = val["method"].asString();
        if (val.isMember("created_at")) e.createdAt = val["created_at"].asString();
        return e;
    }
};

} // namespace models
} // namespace mess_manager
