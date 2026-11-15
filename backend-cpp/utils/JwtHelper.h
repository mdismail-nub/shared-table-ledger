#pragma once

#include <string>
#include <optional>
#include <cstdint>
#include <json/json.h>

namespace mess_manager {
namespace utils {

struct JwtClaims {
    std::string userId;
    std::string role; // "admin" | "member" | "guest"
    std::string messId;
    std::optional<std::string> memberId;
    int64_t issuedAt{0};
    int64_t expiresAt{0};

    bool isExpired(int64_t now) const {
        return expiresAt > 0 && expiresAt < now;
    }
};

class JwtHelper {
public:
    // Creates a signed JWT with HS256
    static std::string createToken(
        const std::string &userId,
        const std::string &role,
        const std::string &messId,
        const std::optional<std::string> &memberId,
        const std::string &secret,
        int64_t ttlSeconds = 30 * 24 * 3600 // default 30 days
    );

    // Validates signature and expiration, returns claims on success
    static std::optional<JwtClaims> verifyToken(
        const std::string &token,
        const std::string &secret,
        int64_t nowSeconds
    );
};

} // namespace utils
} // namespace mess_manager
