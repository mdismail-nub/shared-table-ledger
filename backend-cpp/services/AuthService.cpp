#include "AuthService.h"
#include "../repositories/DatabaseManager.h"
#include "../utils/Crypto.h"
#include "../utils/DateUtils.h"
#include <chrono>

namespace mess_manager {
namespace services {

AuthService::AuthService(std::string jwtSecret)
    : jwtSecret_(std::move(jwtSecret)) {}

std::pair<bool, std::string> AuthService::registerAdmin(
    const std::string &email,
    const std::string &password,
    const std::string &name,
    const std::string &messName,
    const std::string &currency
) {
    auto &db = repositories::DatabaseManager::instance();

    if (db.getUserByEmail(email).has_value()) {
        return {false, "An account with this email already exists."};
    }

    std::string userId = utils::Crypto::generateUuid();
    std::string messId = utils::Crypto::generateUuid();
    std::string memberId = utils::Crypto::generateUuid();
    std::string code = utils::Crypto::generateInviteCode();
    std::string now = utils::DateUtils::getCurrentLocalDate();

    // 1. Create Mess
    models::Mess m;
    m.id = messId;
    m.ownerId = userId;
    m.name = messName.empty() ? "My Mess" : messName;
    m.manager = name;
    m.currency = currency.empty() ? "BDT (৳)" : currency;
    m.inviteCode = code;
    m.showInviteToMembers = true;
    m.createdAt = now;
    db.createMess(m);

    // 2. Create Admin Member entry
    models::Member mem;
    mem.id = memberId;
    mem.messId = messId;
    mem.userId = userId;
    mem.role = "admin";
    mem.name = name;
    mem.joined = now;
    mem.status = "active";
    mem.tone = "primary";
    mem.createdAt = now;
    db.addMember(mem);

    // 3. Create Admin User account
    models::User u;
    u.id = userId;
    u.email = email;
    u.passwordHash = utils::Crypto::sha256(password);
    u.name = name;
    u.messId = messId;
    u.role = "admin";
    u.createdAt = now;
    db.createUser(u);

    return {true, userId};
}

std::optional<models::AuthSession> AuthService::loginAdmin(
    const std::string &email,
    const std::string &password
) {
    auto &db = repositories::DatabaseManager::instance();
    auto userOpt = db.getUserByEmail(email);
    if (!userOpt.has_value()) {
        return std::nullopt;
    }

    const auto &user = *userOpt;
    std::string inputHash = utils::Crypto::sha256(password);
    if (user.passwordHash != inputHash) {
        return std::nullopt;
    }

    auto messOpt = db.getMessById(user.messId);
    std::string inviteCode = messOpt ? messOpt->inviteCode : "";

    // Find member record for admin
    auto members = db.getMembersByMessId(user.messId);
    std::optional<std::string> memberId;
    for (const auto &m : members) {
        if (m.userId && *m.userId == user.id) {
            memberId = m.id;
            break;
        }
    }

    std::string token = utils::JwtHelper::createToken(
        user.id,
        user.role,
        user.messId,
        memberId,
        jwtSecret_
    );

    models::AuthSession session;
    session.userId = user.id;
    session.email = user.email;
    session.name = user.name;
    session.messId = user.messId;
    session.role = user.role;
    session.memberId = memberId;
    session.token = token;
    session.inviteCode = inviteCode;
    session.createdAt = utils::DateUtils::getCurrentLocalDate();

    return session;
}

std::optional<models::GuestSession> AuthService::createGuestSession(
    const std::string &inviteCode,
    const std::optional<std::string> &memberId
) {
    auto &db = repositories::DatabaseManager::instance();
    auto messOpt = db.getMessByInviteCode(inviteCode);
    if (!messOpt.has_value()) {
        return std::nullopt;
    }

    int64_t now = std::chrono::duration_cast<std::chrono::seconds>(
        std::chrono::system_clock::now().time_since_epoch()
    ).count();

    models::GuestSession session;
    session.id = utils::Crypto::generateUuid();
    session.token = "gst_" + utils::Crypto::generateSecureToken(24);
    session.messId = messOpt->id;
    session.memberId = memberId;
    session.role = memberId.has_value() ? "member" : "guest";
    session.expiresAt = now + (30 * 24 * 3600); // 30 days
    session.revoked = false;
    session.createdAt = utils::DateUtils::getCurrentLocalDate();

    db.createGuestSession(session);
    return session;
}

std::optional<utils::JwtClaims> AuthService::verifyAuth(const std::string &token) {
    if (token.empty()) return std::nullopt;

    int64_t now = std::chrono::duration_cast<std::chrono::seconds>(
        std::chrono::system_clock::now().time_since_epoch()
    ).count();

    // 1. Try JWT
    auto jwtClaims = utils::JwtHelper::verifyToken(token, jwtSecret_, now);
    if (jwtClaims.has_value()) {
        return jwtClaims;
    }

    // 2. Try Guest Token
    auto &db = repositories::DatabaseManager::instance();
    auto guestOpt = db.getGuestSession(token);
    if (guestOpt.has_value() && !guestOpt->isExpired(now)) {
        utils::JwtClaims claims;
        claims.userId = guestOpt->token;
        claims.role = guestOpt->role;
        claims.messId = guestOpt->messId;
        claims.memberId = guestOpt->memberId;
        claims.issuedAt = now;
        claims.expiresAt = guestOpt->expiresAt;
        return claims;
    }

    return std::nullopt;
}

} // namespace services
} // namespace mess_manager
