// ============================================================
// ERROR CODES
// ============================================================
export var ErrorCode;
(function (ErrorCode) {
    // Docker errors
    ErrorCode["DOCKER_NOT_INSTALLED"] = "E_DOCKER_NOT_INSTALLED";
    ErrorCode["DOCKER_NOT_RUNNING"] = "E_DOCKER_NOT_RUNNING";
    ErrorCode["DOCKER_IMAGE_MISSING"] = "E_DOCKER_IMAGE_MISSING";
    ErrorCode["DOCKER_TIMEOUT"] = "E_DOCKER_TIMEOUT";
    ErrorCode["DOCKER_EXIT_NONZERO"] = "E_DOCKER_EXIT_NONZERO";
    // Filesystem errors
    ErrorCode["PATH_NOT_FOUND"] = "E_PATH_NOT_FOUND";
    ErrorCode["PATH_NOT_READABLE"] = "E_PATH_NOT_READABLE";
    ErrorCode["ARCHIVE_FAILED"] = "E_ARCHIVE_FAILED";
    ErrorCode["TEMP_DIR_FAILED"] = "E_TEMP_DIR_FAILED";
    ErrorCode["RECEIVE_DIR_FAILED"] = "E_RECEIVE_DIR_FAILED";
    // Wormhole errors
    ErrorCode["CODE_PARSE_FAILED"] = "E_CODE_PARSE_FAILED";
    ErrorCode["TRANSFER_FAILED"] = "E_TRANSFER_FAILED";
    ErrorCode["CODE_INVALID"] = "E_CODE_INVALID";
    // Validation errors
    ErrorCode["EMPTY_PATHS"] = "E_EMPTY_PATHS";
    ErrorCode["EMPTY_CODE"] = "E_EMPTY_CODE";
    ErrorCode["CODE_FORMAT"] = "E_CODE_FORMAT";
})(ErrorCode || (ErrorCode = {}));
//# sourceMappingURL=types.js.map