#pragma once

#include <string>
#include <memory>
#include <unordered_map>
#include <any>
#include <json/json.h>
#include "HttpTypes.h"

namespace drogon {

class AttributesMap {
public:
    template<typename T>
    void insert(const std::string &key, const T &val) {
        map_[key] = std::make_any<T>(val);
    }

    template<typename T>
    void set(const std::string &key, const T &val) {
        insert(key, val);
    }

    template<typename T>
    T get(const std::string &key) const {
        auto it = map_.find(key);
        if (it != map_.end()) {
            try {
                return std::any_cast<T>(it->second);
            } catch (...) {
                return T{};
            }
        }
        return T{};
    }

    bool find(const std::string &key) const {
        return map_.find(key) != map_.end();
    }

private:
    std::unordered_map<std::string, std::any> map_;
};

class HttpRequest;
using HttpRequestPtr = std::shared_ptr<HttpRequest>;

class HttpRequest {
public:
    HttpRequest() : method_(HttpMethod::Get), attributes_(std::make_shared<AttributesMap>()) {}
    virtual ~HttpRequest() = default;

    HttpMethod method() const { return method_; }
    void setMethod(HttpMethod m) { method_ = m; }

    const std::string &path() const { return path_; }
    void setPath(const std::string &p) { path_ = p; }

    const std::string &body() const { return body_; }
    void setBody(const std::string &b) {
        body_ = b;
        parseJsonBody();
    }

    std::shared_ptr<Json::Value> getJsonObject() const {
        return jsonObject_;
    }

    std::string getParameter(const std::string &key) const {
        auto it = parameters_.find(key);
        if (it != parameters_.end()) return it->second;
        return "";
    }

    void setParameter(const std::string &key, const std::string &val) {
        parameters_[key] = val;
    }

    std::string getHeader(const std::string &key) const {
        // Case-insensitive lookup
        for (const auto &[k, v] : headers_) {
            if (equalCaseInsensitive(k, key)) return v;
        }
        return "";
    }

    void setHeader(const std::string &key, const std::string &val) {
        headers_[key] = val;
    }

    const std::unordered_map<std::string, std::string> &headers() const {
        return headers_;
    }

    const std::shared_ptr<AttributesMap> &getAttributes() const {
        return attributes_;
    }

    const std::shared_ptr<AttributesMap> &attributes() const {
        return attributes_;
    }

private:
    void parseJsonBody() {
        if (body_.empty()) return;
        Json::CharReaderBuilder builder;
        auto json = std::make_shared<Json::Value>();
        std::string errs;
        std::istringstream s(body_);
        if (Json::parseFromStream(builder, s, json.get(), &errs)) {
            jsonObject_ = json;
        }
    }

    static bool equalCaseInsensitive(const std::string &a, const std::string &b) {
        if (a.size() != b.size()) return false;
        for (size_t i = 0; i < a.size(); ++i) {
            if (tolower(static_cast<unsigned char>(a[i])) != tolower(static_cast<unsigned char>(b[i]))) {
                return false;
            }
        }
        return true;
    }

    HttpMethod method_;
    std::string path_;
    std::string body_;
    std::unordered_map<std::string, std::string> headers_;
    std::unordered_map<std::string, std::string> parameters_;
    std::shared_ptr<Json::Value> jsonObject_;
    std::shared_ptr<AttributesMap> attributes_;
};

} // namespace drogon
