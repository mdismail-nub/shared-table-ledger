#pragma once

#include <string>
#include <memory>
#include <unordered_map>
#include <json/json.h>
#include "HttpTypes.h"

namespace drogon {

class HttpResponse;
using HttpResponsePtr = std::shared_ptr<HttpResponse>;

class HttpResponse {
public:
    HttpResponse() : statusCode_(k200OK), contentType_(ContentType::CT_TEXT_PLAIN) {}
    virtual ~HttpResponse() = default;

    static HttpResponsePtr newHttpResponse() {
        return std::make_shared<HttpResponse>();
    }

    static HttpResponsePtr newHttpJsonResponse(const Json::Value &json) {
        auto resp = std::make_shared<HttpResponse>();
        resp->setStatusCode(k200OK);
        resp->setContentTypeCode(ContentType::CT_APPLICATION_JSON);
        Json::StreamWriterBuilder writer;
        writer["indentation"] = "";
        resp->setBody(Json::writeString(writer, json));
        return resp;
    }

    void setStatusCode(HttpStatusCode code) {
        statusCode_ = code;
    }

    HttpStatusCode getStatusCode() const {
        return statusCode_;
    }

    int statusCode() const {
        return static_cast<int>(statusCode_);
    }

    void addHeader(const std::string &key, const std::string &value) {
        headers_[key] = value;
    }

    std::string getHeader(const std::string &key) const {
        auto it = headers_.find(key);
        if (it != headers_.end()) return it->second;
        return "";
    }

    const std::unordered_map<std::string, std::string> &headers() const {
        return headers_;
    }

    void setBody(const std::string &body) {
        body_ = body;
    }

    const std::string &getBody() const {
        return body_;
    }

    const std::string &body() const {
        return body_;
    }

    void setContentTypeCode(ContentType type) {
        contentType_ = type;
        switch (type) {
            case ContentType::CT_APPLICATION_JSON:
                contentTypeStr_ = "application/json; charset=utf-8";
                break;
            case ContentType::CT_TEXT_PLAIN:
                contentTypeStr_ = "text/plain; charset=utf-8";
                break;
            case ContentType::CT_TEXT_HTML:
                contentTypeStr_ = "text/html; charset=utf-8";
                break;
            default:
                contentTypeStr_ = "application/octet-stream";
                break;
        }
        headers_["Content-Type"] = contentTypeStr_;
    }

    void setContentTypeString(const std::string &type) {
        contentTypeStr_ = type;
        contentType_ = ContentType::CT_CUSTOM;
        headers_["Content-Type"] = contentTypeStr_;
    }

    const std::string &getContentTypeString() const {
        return contentTypeStr_;
    }

private:
    HttpStatusCode statusCode_;
    ContentType contentType_;
    std::string contentTypeStr_;
    std::string body_;
    std::unordered_map<std::string, std::string> headers_;
};

} // namespace drogon
