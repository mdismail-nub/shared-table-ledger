#include "CsvHelper.h"
#include <sstream>
#include <iomanip>

namespace mess_manager {
namespace utils {

std::string CsvHelper::escapeCell(const std::string &cell) {
    std::string text = cell;

    // Prevent CSV formula injection (OWASP)
    if (!text.empty()) {
        char first = text[0];
        if (first == '=' || first == '+' || first == '-' || first == '@' ||
            first == '\t' || first == '\r') {
            text = "'" + text;
        }
    }

    // Escape quotes
    std::string escaped;
    escaped.reserve(text.size() + 10);
    escaped.push_back('"');
    for (char c : text) {
        if (c == '"') {
            escaped.push_back('"');
            escaped.push_back('"');
        } else {
            escaped.push_back(c);
        }
    }
    escaped.push_back('"');
    return escaped;
}

std::string CsvHelper::generateLedgerCsv(
    const std::vector<models::LedgerRow> &rows,
    const std::string &/*month*/
) {
    std::ostringstream oss;
    // UTF-8 BOM for Microsoft Excel compatibility
    oss << "\xEF\xBB\xBF";

    // Header row
    oss << escapeCell("Member") << ","
        << escapeCell("Meals") << ","
        << escapeCell("Food cost") << ","
        << escapeCell("Shared bills") << ","
        << escapeCell("Charges") << ","
        << escapeCell("Paid") << ","
        << escapeCell("Balance") << "\r\n";

    // Data rows
    for (const auto &r : rows) {
        std::ostringstream mealCostStr;
        mealCostStr << std::fixed << std::setprecision(2) << r.mealCost;

        std::ostringstream sharedStr;
        sharedStr << std::fixed << std::setprecision(2) << r.shared;

        std::ostringstream dueStr;
        dueStr << std::fixed << std::setprecision(2) << r.due;

        std::ostringstream paidStr;
        paidStr << std::fixed << std::setprecision(2) << r.deposits;

        std::ostringstream balanceStr;
        balanceStr << std::fixed << std::setprecision(2) << r.balance;

        std::ostringstream mealsStr;
        mealsStr << r.meals;

        oss << escapeCell(r.name) << ","
            << escapeCell(mealsStr.str()) << ","
            << escapeCell(mealCostStr.str()) << ","
            << escapeCell(sharedStr.str()) << ","
            << escapeCell(dueStr.str()) << ","
            << escapeCell(paidStr.str()) << ","
            << escapeCell(balanceStr.str()) << "\r\n";
    }

    return oss.str();
}

} // namespace utils
} // namespace mess_manager
