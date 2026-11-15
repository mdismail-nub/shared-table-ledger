#pragma once

#include <string>
#include <json/json.h>

namespace mess_manager {
namespace models {

struct Payment {
    std::string id;
    std::string messId;
    std::string date; // "YYYY-MM-DD"
    std::string memberId;
    double amount{0.0};
    std::string method{"Cash"};
    std::string kind{"Deposit"};
    std::string reference;
    std::string createdAt;

    Json::Value toJson() const {
        Json::Value val;
        val["id"] = id;
        val["mess_id"] = messId;
        val["date"] = date;
        val["member_id"] = memberId;
        val["amount"] = amount;
        val["method"] = method;
        val["kind"] = kind;
        val["reference"] = reference;
        val["created_at"] = createdAt;
        return val;
    }

    static Payment fromJson(const Json::Value &val) {
        Payment p;
        if (val.isMember("id")) p.id = val["id"].asString();
        if (val.isMember("mess_id")) p.messId = val["mess_id"].asString();
        if (val.isMember("date")) p.date = val["date"].asString();
        if (val.isMember("member_id")) p.memberId = val["member_id"].asString();
        if (val.isMember("amount")) p.amount = val["amount"].asDouble();
        if (val.isMember("method")) p.method = val["method"].asString();
        if (val.isMember("kind")) p.kind = val["kind"].asString();
        if (val.isMember("reference")) p.reference = val["reference"].asString();
        if (val.isMember("created_at")) p.createdAt = val["created_at"].asString();
        return p;
    }
};

} // namespace models
} // namespace mess_manager
