#pragma once

#include <string>
#include <optional>
#include <utility>
#include "../models/User.h"
#include "../models/GuestSession.h"
#include "../utils/JwtHelper.h"

namespace mess_manager {
namespace services {

class AuthService {
public:
    explicit AuthService(std::string jwtSecret);

    // Registers a new administrator and creates their initial mess workspace
    std::pair<bool, std::string> registerAdmin(
        const std::string &email,
        const std::string &password,
        const std::string &name,
        const std::string &messName,
        const std::string &currency
    );

    // Logs in an existing administrator and returns a signed JWT session
    std::optional<models::AuthSession> loginAdmin(
        const std::string &email,
        const std::string &password
    );

    // Creates an expiring, scoped guest session from a valid 6-digit invitation code
    std::optional<models::GuestSession> createGuestSession(
        const std::string &inviteCode,
        const std::optional<std::string> &memberId
    );

    // Verifies an auth token (either a signed JWT or a guest session token)
    std::optional<utils::JwtClaims> verifyAuth(const std::string &token);

private:
    std::string jwtSecret_;
};

} // namespace services
} // namespace mess_manager
