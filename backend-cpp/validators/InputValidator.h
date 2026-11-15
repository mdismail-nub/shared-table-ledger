#pragma once

#include <string>
#include <optional>

namespace mess_manager {
namespace validators {

class InputValidator {
public:
    static std::optional<std::string> validateMessName(const std::string &name);
    static std::optional<std::string> validateManagerName(const std::string &name);
    static std::optional<std::string> validateInviteCode(const std::string &code);
    static std::optional<std::string> validateMemberName(const std::string &name);
    static std::optional<std::string> validateAmount(double amount);
    static std::optional<std::string> validateMealCount(double count);
    static std::optional<std::string> validateExpenseType(const std::string &type);
    static std::optional<std::string> validateMemberStatus(const std::string &status);
    static std::optional<std::string> validateRole(const std::string &role);
    static std::optional<std::string> validateNotificationTitle(const std::string &title);
    static std::optional<std::string> validateNotificationMessage(const std::string &message);
};

} // namespace validators
} // namespace mess_manager
