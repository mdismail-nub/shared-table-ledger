#include "JwtHelper.h"
#include "Crypto.h"
#include <chrono>
#include <sstream>

namespace mess_manager {
namespace utils {

std::string JwtHelper::createToken(
    const std::string &userId,
    const std::string &role,
    const std::string &messId,
    const std::optional<std::string> &memberId,
    const std::string &secret,
    int64_t ttlSeconds
) {
    int64_t now = std::chrono::duration_cast<std::chrono::seconds>(
        std::chrono::system_clock::now().time_since_epoch()
    ).count();

    Json::Value header;
    header["alg"] = "HS256";
    header["typ"] = "JWT";

    Json::StreamWriterBuilder writer;
    writer["indentation"] = "";
    std::string headerStr = Json::writeString(writer, header);
    std::string headerEncoded = Crypto::base64UrlEncode(headerStr);

    Json::Value payload;
    payload["sub"] = userId;
    payload["role"] = role;
    payload["messId"] = messId;
    if (memberId.has_value()) {
        payload["memberId"] = *memberId;
    } else {
        payload["memberId"] = Json::Value(Json::nullValue);
    }
    payload["iat"] = static_cast<Json::Int64>(now);
    payload["exp"] = static_cast<Json::Int64>(now + ttlSeconds);

    std::string payloadStr = Json::writeString(writer, payload);
    std::string payloadEncoded = Crypto::base64UrlEncode(payloadStr);

    std::string signingInput = headerEncoded + "." + payloadEncoded;
    auto signatureBytes = Crypto::hmacSha256(secret, signingInput);
    std::string signatureEncoded = Crypto::base64UrlEncode(signatureBytes);

    return signingInput + "." + signatureEncoded;
}

std::optional<JwtClaims> JwtHelper::verifyToken(
    const std::string &token,
    const std::string &secret,
    int64_t nowSeconds
) {
    size_t firstDot = token.find('.');
    if (firstDot == std::string::npos) return std::nullopt;
    size_t secondDot = token.find('.', firstDot + 1);
    if (secondDot == std::string::npos) return std::nullopt;

    std::string headerEncoded = token.substr(0, firstDot);
    std::string payloadEncoded = token.substr(firstDot + 1, secondDot - firstDot - 1);
    std::string signatureEncoded = token.substr(secondDot + 1);

    std::string signingInput = headerEncoded + "." + payloadEncoded;
    auto expectedSignature = Crypto::hmacSha256(secret, signingInput);
    std::string expectedSignatureEncoded = Crypto::base64UrlEncode(expectedSignature);

    if (signatureEncoded != expectedSignatureEncoded) {
        return std::nullopt; // Signature mismatch
    }

    std::string payloadJson = Crypto::base64UrlDecode(payloadEncoded);
    Json::CharReaderBuilder reader;
    Json::Value val;
    std::string errs;
    std::istringstream s(payloadJson);
    if (!Json::parseFromStream(reader, s, &val, &errs)) {
        return std::nullopt; // Malformed JSON
    }

    JwtClaims claims;
    if (val.isMember("sub")) claims.userId = val["sub"].asString();
    if (val.isMember("role")) claims.role = val["role"].asString();
    if (val.isMember("messId")) claims.messId = val["messId"].asString();
    if (val.isMember("memberId") && !val["memberId"].isNull()) {
        claims.memberId = val["memberId"].asString();
    }
    if (val.isMember("iat")) claims.issuedAt = val["iat"].asInt64();
    if (val.isMember("exp")) claims.expiresAt = val["exp"].asInt64();

    if (claims.isExpired(nowSeconds)) {
        return std::nullopt; // Token expired
    }

    return claims;
}

} // namespace utils
} // namespace mess_manager
