
cmake_minimum_required(VERSION 3.16)

project(mess_manager_backend
    VERSION 1.0.0
    LANGUAGES CXX
)

# ==================================================
# C++ CONFIGURATION
# ==================================================

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

if(MSVC)
    add_compile_options(/W4 /utf-8)
    add_compile_definitions(_CRT_SECURE_NO_WARNINGS)
else()
    add_compile_options(-Wall -Wextra -Wpedantic)
endif()

include(FetchContent)

# ==================================================
# POSTGRESQL
# ==================================================

find_package(PostgreSQL QUIET)

if(PostgreSQL_FOUND)
    message(STATUS "PostgreSQL found: ${PostgreSQL_LIBRARIES}")
    add_compile_definitions(HAVE_LIBPQ=1)
    set(PG_LINK_LIBS PostgreSQL::PostgreSQL)
else()
    message(STATUS "PostgreSQL not found. Using in-memory storage.")
    set(PG_LINK_LIBS "")
endif()

# ==================================================
# DROGON
# ==================================================

find_package(Drogon QUIET)

if(Drogon_FOUND)
    message(STATUS "Drogon found: ${Drogon_DIR}")
    add_compile_definitions(HAVE_DROGON=1)
    set(DROGON_LINK_LIBS Drogon::Drogon)
else()
    message(STATUS "Drogon not found.")
    set(DROGON_LINK_LIBS "")
endif()

# ==================================================
# JSONCPP
# ==================================================

find_package(jsoncpp CONFIG QUIET)

if(TARGET JsonCpp::JsonCpp)
    set(JSONCPP_TARGET JsonCpp::JsonCpp)
    message(STATUS "Using JsonCpp::JsonCpp")

elseif(TARGET jsoncpp_lib)
    set(JSONCPP_TARGET jsoncpp_lib)
    message(STATUS "Using jsoncpp_lib")

elseif(TARGET jsoncpp_static)
    set(JSONCPP_TARGET jsoncpp_static)
    message(STATUS "Using jsoncpp_static")

else()
    message(STATUS "System JsonCpp target not found. Fetching JsonCpp 1.9.5.")

    FetchContent_Declare(
        jsoncpp
        GIT_REPOSITORY https://github.com/open-source-parsers/jsoncpp.git
        GIT_TAG 1.9.5
        GIT_SHALLOW TRUE
    )

    set(JSONCPP_WITH_TESTS OFF CACHE BOOL "" FORCE)
    set(JSONCPP_WITH_POST_BUILD_UNITTEST OFF CACHE BOOL "" FORCE)
    set(BUILD_SHARED_LIBS OFF CACHE BOOL "" FORCE)
    set(BUILD_STATIC_LIBS ON CACHE BOOL "" FORCE)

    FetchContent_MakeAvailable(jsoncpp)

    if(TARGET JsonCpp::JsonCpp)
        set(JSONCPP_TARGET JsonCpp::JsonCpp)
    elseif(TARGET jsoncpp_static)
        set(JSONCPP_TARGET jsoncpp_static)
    elseif(TARGET jsoncpp_lib)
        set(JSONCPP_TARGET jsoncpp_lib)
    else()
        message(FATAL_ERROR "JsonCpp was fetched but no usable CMake target was found.")
    endif()
endif()

# ==================================================
# COMMON INCLUDE DIRECTORIES
# ==================================================

set(COMMON_INCLUDE_DIRS
    ${CMAKE_CURRENT_SOURCE_DIR}
    ${CMAKE_CURRENT_SOURCE_DIR}/include
    ${CMAKE_CURRENT_SOURCE_DIR}/models
    ${CMAKE_CURRENT_SOURCE_DIR}/services
    ${CMAKE_CURRENT_SOURCE_DIR}/repositories
    ${CMAKE_CURRENT_SOURCE_DIR}/validators
    ${CMAKE_CURRENT_SOURCE_DIR}/utils
    ${CMAKE_CURRENT_SOURCE_DIR}/middleware
    ${CMAKE_CURRENT_SOURCE_DIR}/controllers
)

# ==================================================
# COMMON SOURCE FILES
# ==================================================

set(CORE_SOURCES
    utils/Crypto.cpp
    utils/JwtHelper.cpp
    utils/DateUtils.cpp
    utils/CsvHelper.cpp
    validators/InputValidator.cpp
    services/AccountingEngine.cpp
    services/DomainServices.cpp
    services/AuthService.cpp
    services/WorkspaceService.cpp
    repositories/PgClient.cpp
    repositories/DatabaseManager.cpp
)

# ==================================================
# TEST EXECUTABLE
# ==================================================

add_executable(mess_manager_tests
    tests/AccountingEngineTest.cpp
    ${CORE_SOURCES}
)

target_include_directories(mess_manager_tests PRIVATE
    ${COMMON_INCLUDE_DIRS}
)

target_link_libraries(mess_manager_tests PRIVATE
    ${JSONCPP_TARGET}
    ${PG_LINK_LIBS}
)

if(WIN32)
    target_link_libraries(mess_manager_tests PRIVATE ws2_32)
else()
    target_link_libraries(mess_manager_tests PRIVATE pthread)
endif()

# ==================================================
# SERVER EXECUTABLE
# ==================================================

set(SERVER_SOURCES
    main.cpp
    ${CORE_SOURCES}
    middleware/AuthFilter.cpp
    middleware/CorsFilter.cpp
    controllers/AuthController.cpp
    controllers/WorkspaceController.cpp
    controllers/MemberController.cpp
    controllers/MealController.cpp
    controllers/ExpenseController.cpp
    controllers/PaymentController.cpp
    controllers/AccountingController.cpp
    controllers/NotificationController.cpp
    controllers/ReportController.cpp
    controllers/SettingsController.cpp
    controllers/HealthController.cpp
)

add_executable(mess_manager_server
    ${SERVER_SOURCES}
)

target_include_directories(mess_manager_server PRIVATE
    ${COMMON_INCLUDE_DIRS}
)

target_link_libraries(mess_manager_server PRIVATE
    ${JSONCPP_TARGET}
    ${PG_LINK_LIBS}
    ${DROGON_LINK_LIBS}
)

if(WIN32)
    target_link_libraries(mess_manager_server PRIVATE ws2_32)
else()
    target_link_libraries(mess_manager_server PRIVATE pthread)
endif()

# ==================================================
# TESTING
# ==================================================

enable_testing()

add_test(
    NAME AccountingEngineUnitTests
    COMMAND mess_manager_tests
)

message(STATUS "======================================")
message(STATUS "Mess Manager Backend Configuration")
message(STATUS "JSONCpp target: ${JSONCPP_TARGET}")
message(STATUS "PostgreSQL: ${PostgreSQL_FOUND}")
message(STATUS "Drogon: ${Drogon_FOUND}")
message(STATUS "======================================")
