#include "PgClient.h"
#include <algorithm>
#include <cstdlib>
#include <cstring>

namespace mess_manager {
namespace repositories {

PgClient::PgClient() = default;

PgClient::~PgClient() {
    disconnect();
}

PgClient &PgClient::instance() {
    static PgClient inst;
    return inst;
}

std::string PgClient::normalizeConnectionString(const std::string &raw) {
    if (!raw.empty()) {
        std::string conn = raw;
        // If connecting to remote cloud database (like Render, Neon, Supabase) and sslmode is not specified, enforce sslmode=require
        bool isLocal = (conn.find("localhost") != std::string::npos || conn.find("127.0.0.1") != std::string::npos);
        if (!isLocal && conn.find("sslmode=") == std::string::npos) {
            if (conn.find('?') == std::string::npos) {
                conn += "?sslmode=require";
            } else {
                conn += "&sslmode=require";
            }
        }
        return conn;
    }

    // Attempt to assemble from standard PG environment variables
    const char *pghost = std::getenv("PGHOST");
    const char *pgport = std::getenv("PGPORT");
    const char *pgdatabase = std::getenv("PGDATABASE");
    const char *pguser = std::getenv("PGUSER");
    const char *pgpassword = std::getenv("PGPASSWORD");

    if (pghost && pgdatabase && pguser) {
        std::string assembled = "host=" + std::string(pghost) +
                                " port=" + (pgport ? std::string(pgport) : "5432") +
                                " dbname=" + std::string(pgdatabase) +
                                " user=" + std::string(pguser);
        if (pgpassword) {
            assembled += " password=" + std::string(pgpassword);
        }
        return assembled;
    }

    return "";
}

bool PgClient::connect(const std::string &connString) {
    std::lock_guard<std::mutex> lock(mutex_);
    disconnect();

    connString_ = normalizeConnectionString(connString);
    if (connString_.empty()) {
        lastError_ = "No PostgreSQL connection string or PG environment variables provided.";
        return false;
    }

#ifdef HAVE_LIBPQ
    conn_ = PQconnectdb(connString_.c_str());
    if (!conn_ || PQstatus(conn_) != CONNECTION_OK) {
        lastError_ = conn_ ? PQerrorMessage(conn_) : "Failed to allocate memory for PostgreSQL connection.";
        if (conn_) {
            PQfinish(conn_);
            conn_ = nullptr;
        }
        isConnected_ = false;
        return false;
    }

    isConnected_ = true;
    lastError_.clear();
    return true;
#else
    lastError_ = "libpq is not compiled into this binary (build with libpq-dev on Linux/Docker).";
    isConnected_ = false;
    return false;
#endif
}

void PgClient::disconnect() {
#ifdef HAVE_LIBPQ
    if (conn_) {
        PQfinish(conn_);
        conn_ = nullptr;
    }
#endif
    isConnected_ = false;
}

bool PgClient::isConnected() const {
    std::lock_guard<std::mutex> lock(mutex_);
#ifdef HAVE_LIBPQ
    return isConnected_ && conn_ && (PQstatus(conn_) == CONNECTION_OK);
#else
    return false;
#endif
}

std::string PgClient::getLastError() const {
    std::lock_guard<std::mutex> lock(mutex_);
    return lastError_;
}

PgResult PgClient::exec(const std::string &sql) {
    std::lock_guard<std::mutex> lock(mutex_);
#ifdef HAVE_LIBPQ
    if (!conn_ || PQstatus(conn_) != CONNECTION_OK) {
        return PgResult(false, "PostgreSQL not connected.");
    }

    PGresult *res = PQexec(conn_, sql.c_str());
    if (!res) {
        return PgResult(false, PQerrorMessage(conn_));
    }

    ExecStatusType status = PQresultStatus(res);
    if (status != PGRES_COMMAND_OK && status != PGRES_TUPLES_OK) {
        std::string err = PQresultErrorMessage(res);
        PQclear(res);
        return PgResult(false, err);
    }

    PgResult result(true);
    if (status == PGRES_TUPLES_OK) {
        int nRows = PQntuples(res);
        int nCols = PQnfields(res);
        std::vector<std::string> colNames;
        colNames.reserve(nCols);
        for (int c = 0; c < nCols; ++c) {
            colNames.emplace_back(PQfname(res, c));
        }

        for (int r = 0; r < nRows; ++r) {
            std::vector<std::optional<std::string>> vals;
            vals.reserve(nCols);
            for (int c = 0; c < nCols; ++c) {
                if (PQgetisnull(res, r, c)) {
                    vals.push_back(std::nullopt);
                } else {
                    vals.push_back(std::string(PQgetvalue(res, r, c)));
                }
            }
            result.addRow(PgRow(colNames, vals));
        }
    }

    PQclear(res);
    return result;
#else
    (void)sql;
    return PgResult(false, "libpq is not compiled into this binary.");
#endif
}

PgResult PgClient::execParams(const std::string &sql, const std::vector<std::string> &params) {
    std::lock_guard<std::mutex> lock(mutex_);
#ifdef HAVE_LIBPQ
    if (!conn_ || PQstatus(conn_) != CONNECTION_OK) {
        return PgResult(false, "PostgreSQL not connected.");
    }

    std::vector<const char *> paramValues;
    paramValues.reserve(params.size());
    for (const auto &p : params) {
        if (p == "__NULL__") {
            paramValues.push_back(nullptr);
        } else {
            paramValues.push_back(p.c_str());
        }
    }

    PGresult *res = PQexecParams(
        conn_,
        sql.c_str(),
        static_cast<int>(params.size()),
        nullptr, // Let server infer types
        paramValues.data(),
        nullptr, // Text format
        nullptr, // Text format
        0        // Text result format
    );

    if (!res) {
        return PgResult(false, PQerrorMessage(conn_));
    }

    ExecStatusType status = PQresultStatus(res);
    if (status != PGRES_COMMAND_OK && status != PGRES_TUPLES_OK) {
        std::string err = PQresultErrorMessage(res);
        PQclear(res);
        return PgResult(false, err);
    }

    PgResult result(true);
    if (status == PGRES_TUPLES_OK) {
        int nRows = PQntuples(res);
        int nCols = PQnfields(res);
        std::vector<std::string> colNames;
        colNames.reserve(nCols);
        for (int c = 0; c < nCols; ++c) {
            colNames.emplace_back(PQfname(res, c));
        }

        for (int r = 0; r < nRows; ++r) {
            std::vector<std::optional<std::string>> vals;
            vals.reserve(nCols);
            for (int c = 0; c < nCols; ++c) {
                if (PQgetisnull(res, r, c)) {
                    vals.push_back(std::nullopt);
                } else {
                    vals.push_back(std::string(PQgetvalue(res, r, c)));
                }
            }
            result.addRow(PgRow(colNames, vals));
        }
    }

    PQclear(res);
    return result;
#else
    (void)sql;
    (void)params;
    return PgResult(false, "libpq is not compiled into this binary.");
#endif
}

} // namespace repositories
} // namespace mess_manager
