function(RUN_OK)
  execute_process(COMMAND ${ARGV} RESULT_VARIABLE STATUS OUTPUT_VARIABLE OUT ERROR_VARIABLE ERR)
  if(NOT "${STATUS}" STREQUAL "0" OR NOT ERR STREQUAL "")
    message(FATAL_ERROR "Recursive record bridge: ${STATUS}: ${OUT}${ERR}")
  endif()
endfunction()
file(MAKE_DIRECTORY "${OUTPUT_DIR}")
set(FLAGS -O0)
if(VARIANT STREQUAL "optimized")
  set(FLAGS -O2)
elseif(VARIANT STREQUAL "sanitized")
  set(FLAGS -O1 -g -fsanitize=address,undefined -fno-sanitize-recover=all -fno-omit-frame-pointer)
elseif(VARIANT STREQUAL "thread-sanitized")
  set(FLAGS -O1 -g -fsanitize=thread -fno-omit-frame-pointer)
endif()
RUN_OK("${EMITTER}" "${OUTPUT_DIR}/bridge.ll")
RUN_OK("${CLANGXX}" -std=c++23 -Wall -Wextra -Werror -Wno-override-module ${FLAGS}
  "${SOURCE_DIR}/tests/RecursiveRecordBridgeTests.cpp" "${OUTPUT_DIR}/bridge.ll"
  "${RUNTIME}" -o "${OUTPUT_DIR}/bridge")
RUN_OK("${OUTPUT_DIR}/bridge")
RUN_OK("${CLANGXX}" -std=c++23 -Wall -Wextra -Werror -Wno-override-module ${FLAGS}
  "-I${SOURCE_DIR}/include" "${SOURCE_DIR}/tests/RecursiveCollectionBridgeTests.cpp"
  "${OUTPUT_DIR}/bridge.ll" "${RUNTIME}" -o "${OUTPUT_DIR}/collections")
RUN_OK("${OUTPUT_DIR}/collections")
