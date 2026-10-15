file(WRITE "${OUTPUT_DIR}/invalid-types.kalandra"
  "fn first() -> float32:\n  unknown\nfn second(x: Tensor[float32,2,3]) -> float32:\n  x\n")
execute_process(COMMAND "${CHECKER}" --dump-ir "${OUTPUT_DIR}/invalid-types.kalandra"
  RESULT_VARIABLE STATUS OUTPUT_VARIABLE STDOUT ERROR_VARIABLE STDERR)
if(NOT "${STATUS}" STREQUAL "1" OR NOT STDOUT STREQUAL "" OR
   NOT STDERR MATCHES "invalid-types.kalandra:2:3: error\\[S016\\]" OR
   NOT STDERR MATCHES "error\\[S010\\]")
  message(FATAL_ERROR "Expected semantic errors with no partial IR: ${STATUS}: ${STDOUT}${STDERR}")
endif()
