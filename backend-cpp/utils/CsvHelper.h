#pragma once

#include <string>
#include <vector>
#include "../models/AccountingModels.h"

namespace mess_manager {
namespace utils {

class CsvHelper {
public:
    // Escapes a cell according to RFC 4180 and sanitizes formula injection
    static std::string escapeCell(const std::string &cell);

    // Generates a full CSV document from ledger rows
    static std::string generateLedgerCsv(
        const std::vector<models::LedgerRow> &rows,
        const std::string &month
    );
};

} // namespace utils
} // namespace mess_manager
