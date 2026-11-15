#pragma once

#include <string>
#include <optional>
#include "../models/AccountingModels.h"
#include "../utils/JwtHelper.h"

namespace mess_manager {
namespace services {

class WorkspaceService {
public:
    // Resolves and computes the full WorkspaceData for a mess and month
    static std::optional<models::WorkspaceData> getWorkspace(
        const std::string &messId,
        const std::string &month,
        const std::optional<utils::JwtClaims> &auth
    );

    // Resolves workspace using a 6-digit invitation code (for guest members)
    static std::optional<models::WorkspaceData> getWorkspaceByInviteCode(
        const std::string &inviteCode,
        const std::string &month,
        const std::optional<utils::JwtClaims> &auth
    );
};

} // namespace services
} // namespace mess_manager
