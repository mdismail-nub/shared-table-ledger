#pragma once

#include <string>
#include <vector>
#include <json/json.h>

namespace mess_manager {
namespace models {

struct Mess {
    std::string id;
    std::string ownerId;
    std::string name;
    std::string address;
    std::string manager;
    int startDay{1};
    std::string currency{"BDT (৳)"};
    std::string inviteCode;
    bool showInviteToMembers{true};
    std::vector<std::string> mealCategories{
        "Rice", "Vegetables", "Fish & meat", "Eggs", "Cooking oil", "Spices", "Other food"
    };
    std::vector<std::string> householdCategories{
        "Wi-Fi", "Electricity", "Gas", "Water", "Cleaning", "Other household"
    };
    std::string createdAt;

    Json::Value toJson(bool includePrivate = true) const {
        Json::Value val;
        val["id"] = id;
        if (includePrivate) {
            val["owner_id"] = ownerId;
            val["invite_code"] = inviteCode;
        } else {
            val["owner_id"] = "";
            if (showInviteToMembers) {
                val["invite_code"] = inviteCode;
            }
        }
        val["name"] = name;
        val["address"] = address;
        val["manager"] = manager;
        val["start_day"] = startDay;
        val["currency"] = currency;
        val["show_invite_to_members"] = showInviteToMembers;

        Json::Value mealCats(Json::arrayValue);
        for (const auto &cat : mealCategories) mealCats.append(cat);
        val["meal_categories"] = mealCats;

        Json::Value houseCats(Json::arrayValue);
        for (const auto &cat : householdCategories) houseCats.append(cat);
        val["household_categories"] = houseCats;

        val["created_at"] = createdAt;
        return val;
    }

    static Mess fromJson(const Json::Value &val) {
        Mess m;
        if (val.isMember("id")) m.id = val["id"].asString();
        if (val.isMember("owner_id")) m.ownerId = val["owner_id"].asString();
        if (val.isMember("name")) m.name = val["name"].asString();
        if (val.isMember("address")) m.address = val["address"].asString();
        if (val.isMember("manager")) m.manager = val["manager"].asString();
        if (val.isMember("start_day")) m.startDay = val["start_day"].asInt();
        if (val.isMember("currency")) m.currency = val["currency"].asString();
        if (val.isMember("invite_code")) m.inviteCode = val["invite_code"].asString();
        if (val.isMember("show_invite_to_members")) m.showInviteToMembers = val["show_invite_to_members"].asBool();

        if (val.isMember("meal_categories") && val["meal_categories"].isArray()) {
            m.mealCategories.clear();
            for (const auto &item : val["meal_categories"]) {
                m.mealCategories.push_back(item.asString());
            }
        }
        if (val.isMember("household_categories") && val["household_categories"].isArray()) {
            m.householdCategories.clear();
            for (const auto &item : val["household_categories"]) {
                m.householdCategories.push_back(item.asString());
            }
        }
        if (val.isMember("created_at")) m.createdAt = val["created_at"].asString();
        return m;
    }
};

} // namespace models
} // namespace mess_manager
