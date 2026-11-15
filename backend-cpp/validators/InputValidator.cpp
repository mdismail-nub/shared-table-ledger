#include "InputValidator.h"
#include <regex>

namespace mess_manager {
namespace validators {

namespace {
std::string trim(const std::string &str) {
    size_t first = str.find_first_not_of(" \t\n\r");
    if (first == std::string::npos) return "";
    size_t last = str.find_last_not_of(" \t\n\r");
    return str.substr(first, (last - first + 1));
}
}

std::optional<std::string> InputValidator::validateMessName(const std::string &name) {
    std::string trimmed = trim(name);
    if (trimmed.length() < 2 || trimmed.length() > 80) {
        return "Mess name must be between 2 and 80 characters.";
    }
    return std::nullopt;
}

std::optional<std::string> InputValidator::validateManagerName(const std::string &name) {
    std::string trimmed = trim(name);
    if (trimmed.length() < 1 || trimmed.length() > 80) {
        return "Manager name must be between 1 and 80 characters.";
    }
    return std::nullopt;
}

std::optional<std::string> InputValidator::validateInviteCode(const std::string &code) {
    static const std::regex codeRegex(R"(^\d{6}$)");
    if (!std::regex_match(code, codeRegex)) {
        return "Invitation code must be exactly 6 numeric digits.";
    }
    return std::nullopt;
}

std::optional<std::string> InputValidator::validateMemberName(const std::string &name) {
    std::string trimmed = trim(name);
    if (trimmed.length() < 1 || trimmed.length() > 80) {
        return "Member name must be between 1 and 80 characters.";
    }
    return std::nullopt;
}

std::optional<std::string> InputValidator::validateAmount(double amount) {
    if (amount <= 0.0 || amount >= 10000000.0) {
        return "Amount must be greater than ৳0 and less than ৳10,000,000.";
    }
    return std::nullopt;
}

std::optional<std::string> InputValidator::validateMealCount(double count) {
    if (count < 0.0 || count > 10.0) {
        return "Meal count must be between 0 and 10 per slot.";
    }
    return std::nullopt;
}

std::optional<std::string> InputValidator::validateExpenseType(const std::string &type) {
    if (type != "meal" && type != "household") {
        return "Expense type must be either 'meal' or 'household'.";
    }
    return std::nullopt;
}

std::optional<std::string> InputValidator::validateMemberStatus(const std::string &status) {
    if (status != "active" && status != "new" && status != "left") {
        return "Member status must be 'active', 'new', or 'left'.";
    }
    return std::nullopt;
}

std::optional<std::string> InputValidator::validateRole(const std::string &role) {
    if (role != "admin" && role != "member") {
        return "Role must be 'admin' or 'member'.";
    }
    return std::nullopt;
}

std::optional<std::string> InputValidator::validateNotificationTitle(const std::string &title) {
    std::string trimmed = trim(title);
    if (trimmed.empty() || trimmed.length() > 120) {
        return "Notification title must be between 1 and 120 characters.";
    }
    return std::nullopt;
}

std::optional<std::string> InputValidator::validateNotificationMessage(const std::string &message) {
    std::string trimmed = trim(message);
    if (trimmed.empty() || trimmed.length() > 1000) {
        return "Notification message must be between 1 and 1000 characters.";
    }
    return std::nullopt;
}

} // namespace validators
} // namespace mess_manager
