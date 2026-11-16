#pragma once

#include <string>
#include <vector>
#include <unordered_map>
#include <memory>
#include <mutex>
#include <optional>
#include <iostream>

#ifdef HAVE_LIBPQ
#include <libpq-fe.h>
#endif

namespace mess_manager {
namespace repositories {

class PgRow {
public:
    PgRow() = default;
    PgRow(std::vector<std::string> colNames, std::vector<std::optional<std::string>> values)
        : colNames_(std::move(colNames)), values_(std::move(values)) {
        for (size_t i = 0; i < colNames_.size(); ++i) {
            indexMap_[colNames_[i]] = i;
        }
    }

    bool isNull(const std::string &colName) const {
        auto it = indexMap_.find(colName);
        if (it == indexMap_.end() || it->second >= values_.size()) return true;
        return !values_[it->second].has_value();
    }

    std::string get(const std::string &colName, const std::string &defaultVal = "") const {
        auto it = indexMap_.find(colName);
        if (it == indexMap_.end() || it->second >= values_.size()) return defaultVal;
        return values_[it->second].value_or(defaultVal);
    }

    double getDouble(const std::string &colName, double defaultVal = 0.0) const {
        std::string s = get(colName);
        if (s.empty()) return defaultVal;
        try {
            return std::stod(s);
        } catch (...) {
            return defaultVal;
        }
    }

    int getInt(const std::string &colName, int defaultVal = 0) const {
        std::string s = get(colName);
        if (s.empty()) return defaultVal;
        try {
            return std::stoi(s);
        } catch (...) {
            return defaultVal;
        }
    }

    bool getBool(const std::string &colName, bool defaultVal = false) const {
        std::string s = get(colName);
        if (s.empty()) return defaultVal;
        return s == "t" || s == "true" || s == "1" || s == "TRUE";
    }

private:
    std::vector<std::string> colNames_;
    std::vector<std::optional<std::string>> values_;
    std::unordered_map<std::string, size_t> indexMap_;
};

class PgResult {
public:
    PgResult(bool ok, std::string error = "") : ok_(ok), error_(std::move(error)) {}
    
    bool ok() const { return ok_; }
    const std::string &error() const { return error_; }
    size_t size() const { return rows_.size(); }
    bool empty() const { return rows_.empty(); }

    const PgRow &operator[](size_t index) const { return rows_[index]; }
    const std::vector<PgRow> &rows() const { return rows_; }
    void addRow(PgRow row) { rows_.push_back(std::move(row)); }

private:
    bool ok_{false};
    std::string error_;
    std::vector<PgRow> rows_;
};

class PgClient {
public:
    static PgClient &instance();

    bool connect(const std::string &connString);
    void disconnect();
    bool isConnected() const;
    std::string getLastError() const;

    PgResult exec(const std::string &sql);
    PgResult execParams(const std::string &sql, const std::vector<std::string> &params);

private:
    PgClient();
    ~PgClient();
    PgClient(const PgClient &) = delete;
    PgClient &operator=(const PgClient &) = delete;

    std::string normalizeConnectionString(const std::string &raw);

    mutable std::mutex mutex_;
    std::string connString_;
    std::string lastError_;
    bool isConnected_{false};

#ifdef HAVE_LIBPQ
    PGconn *conn_{nullptr};
#else
    void *conn_{nullptr};
#endif
};

} // namespace repositories
} // namespace mess_manager
