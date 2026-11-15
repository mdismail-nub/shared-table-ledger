#pragma once

#include <string>
#include <vector>
#include <cstdint>

namespace mess_manager {
namespace utils {

class Crypto {
public:
    // Computes SHA-256 hash as lowercase hex string
    static std::string sha256(const std::string &input);

    // Computes HMAC-SHA256 as raw bytes
    static std::vector<uint8_t> hmacSha256(const std::string &key, const std::string &message);

    // Computes HMAC-SHA256 as lowercase hex string
    static std::string hmacSha256Hex(const std::string &key, const std::string &message);

    // Encodes raw bytes to base64url string (RFC 7515)
    static std::string base64UrlEncode(const std::string &input);
    static std::string base64UrlEncode(const std::vector<uint8_t> &bytes);

    // Decodes base64url string to raw string
    static std::string base64UrlDecode(const std::string &input);

    // Generates a cryptographically secure random 6-digit numeric invite code
    static std::string generateInviteCode();

    // Generates a cryptographically secure random token (e.g. 32-byte hex)
    static std::string generateSecureToken(size_t byteCount = 32);

    // Generates a UUID v4 string
    static std::string generateUuid();
};

} // namespace utils
} // namespace mess_manager
