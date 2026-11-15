#pragma once

#include <string>
#include <json/json.h>

namespace mess_manager {
namespace models {

struct Meal {
    std::string id;
    std::string messId;
    std::string memberId;
    std::string date; // "YYYY-MM-DD"
    double breakfast{0.0};
    double lunch{0.0};
    double dinner{0.0};

    double total() const {
        return breakfast + lunch + dinner;
    }

    Json::Value toJson() const {
        Json::Value val;
        val["id"] = id;
        val["mess_id"] = messId;
        val["member_id"] = memberId;
        val["date"] = date;
        val["breakfast"] = breakfast;
        val["lunch"] = lunch;
        val["dinner"] = dinner;
        return val;
    }

    static Meal fromJson(const Json::Value &val) {
        Meal m;
        if (val.isMember("id")) m.id = val["id"].asString();
        if (val.isMember("mess_id")) m.messId = val["mess_id"].asString();
        if (val.isMember("member_id")) m.memberId = val["member_id"].asString();
        if (val.isMember("date")) m.date = val["date"].asString();
        if (val.isMember("breakfast")) m.breakfast = val["breakfast"].asDouble();
        if (val.isMember("lunch")) m.lunch = val["lunch"].asDouble();
        if (val.isMember("dinner")) m.dinner = val["dinner"].asDouble();
        return m;
    }
};

} // namespace models
} // namespace mess_manager
