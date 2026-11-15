#include "Crypto.h"
#include <sstream>
#include <iomanip>
#include <random>
#include <cstring>
#include <array>

namespace mess_manager {
namespace utils {

namespace {

// Standard SHA-256 implementation (FIPS 180-4)
inline uint32_t rotr(uint32_t x, uint32_t n) {
    return (x >> n) | (x << (32 - n));
}
inline uint32_t choose(uint32_t e, uint32_t f, uint32_t g) {
    return (e & f) ^ (~e & g);
}
inline uint32_t majority(uint32_t a, uint32_t b, uint32_t c) {
    return (a & b) ^ (a & c) ^ (b & c);
}
inline uint32_t sig0(uint32_t x) {
    return rotr(x, 2) ^ rotr(x, 13) ^ rotr(x, 22);
}
inline uint32_t sig1(uint32_t x) {
    return rotr(x, 6) ^ rotr(x, 11) ^ rotr(x, 25);
}
inline uint32_t theta0(uint32_t x) {
    return rotr(x, 7) ^ rotr(x, 18) ^ (x >> 3);
}
inline uint32_t theta1(uint32_t x) {
    return rotr(x, 17) ^ rotr(x, 19) ^ (x >> 10);
}

const uint32_t K[64] = {
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
};

std::array<uint8_t, 32> sha256Raw(const uint8_t *data, size_t length) {
    uint32_t H[8] = {
        0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
        0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
    };

    uint64_t bitLength = length * 8;
    size_t newLength = (length + 9 + 63) / 64 * 64;
    std::vector<uint8_t> padded(newLength, 0);
    if (length > 0) std::memcpy(padded.data(), data, length);
    padded[length] = 0x80;

    for (int i = 0; i < 8; ++i) {
        padded[newLength - 1 - i] = static_cast<uint8_t>(bitLength >> (i * 8));
    }

    for (size_t chunk = 0; chunk < newLength; chunk += 64) {
        uint32_t W[64];
        for (int i = 0; i < 16; ++i) {
            W[i] = (static_cast<uint32_t>(padded[chunk + i * 4]) << 24) |
                   (static_cast<uint32_t>(padded[chunk + i * 4 + 1]) << 16) |
                   (static_cast<uint32_t>(padded[chunk + i * 4 + 2]) << 8) |
                   (static_cast<uint32_t>(padded[chunk + i * 4 + 3]));
        }
        for (int i = 16; i < 64; ++i) {
            W[i] = theta1(W[i - 2]) + W[i - 7] + theta0(W[i - 15]) + W[i - 16];
        }

        uint32_t a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];

        for (int i = 0; i < 64; ++i) {
            uint32_t T1 = h + sig1(e) + choose(e, f, g) + K[i] + W[i];
            uint32_t T2 = sig0(a) + majority(a, b, c);
            h = g;
            g = f;
            f = e;
            e = d + T1;
            d = c;
            c = b;
            b = a;
            a = T1 + T2;
        }

        H[0] += a; H[1] += b; H[2] += c; H[3] += d;
        H[4] += e; H[5] += f; H[6] += g; H[7] += h;
    }

    std::array<uint8_t, 32> digest;
    for (int i = 0; i < 8; ++i) {
        digest[i * 4] = static_cast<uint8_t>(H[i] >> 24);
        digest[i * 4 + 1] = static_cast<uint8_t>(H[i] >> 16);
        digest[i * 4 + 2] = static_cast<uint8_t>(H[i] >> 8);
        digest[i * 4 + 3] = static_cast<uint8_t>(H[i]);
    }
    return digest;
}

} // anonymous namespace

std::string Crypto::sha256(const std::string &input) {
    auto digest = sha256Raw(reinterpret_cast<const uint8_t*>(input.data()), input.size());
    std::ostringstream oss;
    for (uint8_t b : digest) {
        oss << std::hex << std::setw(2) << std::setfill('0') << static_cast<int>(b);
    }
    return oss.str();
}

std::vector<uint8_t> Crypto::hmacSha256(const std::string &key, const std::string &message) {
    const size_t blockSize = 64;
    std::vector<uint8_t> k(blockSize, 0);

    if (key.size() > blockSize) {
        auto keyDigest = sha256Raw(reinterpret_cast<const uint8_t*>(key.data()), key.size());
        std::memcpy(k.data(), keyDigest.data(), 32);
    } else {
        std::memcpy(k.data(), key.data(), key.size());
    }

    std::vector<uint8_t> oKeyPad(blockSize);
    std::vector<uint8_t> iKeyPad(blockSize);
    for (size_t i = 0; i < blockSize; ++i) {
        oKeyPad[i] = k[i] ^ 0x5c;
        iKeyPad[i] = k[i] ^ 0x36;
    }

    // Inner hash: H(iKeyPad || message)
    std::vector<uint8_t> innerData = iKeyPad;
    innerData.insert(innerData.end(), message.begin(), message.end());
    auto innerHash = sha256Raw(innerData.data(), innerData.size());

    // Outer hash: H(oKeyPad || innerHash)
    std::vector<uint8_t> outerData = oKeyPad;
    outerData.insert(outerData.end(), innerHash.begin(), innerHash.end());
    auto outerHash = sha256Raw(outerData.data(), outerData.size());

    return std::vector<uint8_t>(outerHash.begin(), outerHash.end());
}

std::string Crypto::hmacSha256Hex(const std::string &key, const std::string &message) {
    auto hmac = hmacSha256(key, message);
    std::ostringstream oss;
    for (uint8_t b : hmac) {
        oss << std::hex << std::setw(2) << std::setfill('0') << static_cast<int>(b);
    }
    return oss.str();
}

std::string Crypto::base64UrlEncode(const std::vector<uint8_t> &bytes) {
    static const char base64urlChars[] =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

    std::string out;
    int val = 0, valb = -6;
    for (uint8_t c : bytes) {
        val = (val << 8) + c;
        valb += 8;
        while (valb >= 0) {
            out.push_back(base64urlChars[(val >> valb) & 0x3F]);
            valb -= 6;
        }
    }
    if (valb > -6) {
        out.push_back(base64urlChars[((val << 8) >> (valb + 8)) & 0x3F]);
    }
    return out;
}

std::string Crypto::base64UrlEncode(const std::string &input) {
    std::vector<uint8_t> bytes(input.begin(), input.end());
    return base64UrlEncode(bytes);
}

std::string Crypto::base64UrlDecode(const std::string &input) {
    static const int base64urlTable[256] = {
        -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1,
        -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1,
        -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 62, -1, -1,
        52, 53, 54, 55, 56, 57, 58, 59, 60, 61, -1, -1, -1, -1, -1, -1,
        -1,  0,  1,  2,  3,  4,  5,  6,  7,  8,  9, 10, 11, 12, 13, 14,
        15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, -1, -1, -1, -1, 63,
        -1, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40,
        41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, -1, -1, -1, -1, -1
    };

    std::string out;
    int val = 0, valb = -8;
    for (unsigned char c : input) {
        if (c == '=') break;
        int d = base64urlTable[c];
        if (d == -1) continue;
        val = (val << 6) + d;
        valb += 6;
        if (valb >= 0) {
            out.push_back(static_cast<char>((val >> valb) & 0xFF));
            valb -= 8;
        }
    }
    return out;
}

std::string Crypto::generateInviteCode() {
    std::random_device rd;
    std::mt19937 gen(rd());
    std::uniform_int_distribution<int> dist(0, 999999);
    int num = dist(gen);
    std::ostringstream oss;
    oss << std::setw(6) << std::setfill('0') << num;
    return oss.str();
}

std::string Crypto::generateSecureToken(size_t byteCount) {
    std::random_device rd;
    std::mt19937_64 gen(rd());
    std::uniform_int_distribution<uint32_t> dist(0, 255);

    std::ostringstream oss;
    for (size_t i = 0; i < byteCount; ++i) {
        oss << std::hex << std::setw(2) << std::setfill('0') << dist(gen);
    }
    return oss.str();
}

std::string Crypto::generateUuid() {
    std::random_device rd;
    std::mt19937_64 gen(rd());
    std::uniform_int_distribution<uint32_t> dist(0, 0xFFFFFFFF);

    uint32_t p1 = dist(gen);
    uint32_t p2 = dist(gen);
    uint32_t p3 = dist(gen);
    uint32_t p4 = dist(gen);

    // Set UUID v4 flags: variant (0x80) and version (0x40)
    p2 = (p2 & 0xFFFF0FFF) | 0x00004000;
    p3 = (p3 & 0x3FFFFFFF) | 0x80000000;

    std::ostringstream oss;
    oss << std::hex << std::setfill('0')
        << std::setw(8) << p1 << "-"
        << std::setw(4) << (p2 >> 16) << "-"
        << std::setw(4) << (p2 & 0xFFFF) << "-"
        << std::setw(4) << (p3 >> 16) << "-"
        << std::setw(4) << (p3 & 0xFFFF)
        << std::setw(8) << p4;
    return oss.str();
}

} // namespace utils
} // namespace mess_manager
