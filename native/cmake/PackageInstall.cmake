if(BUILD_TESTING)
  add_executable(kalandra-package-install-tests-sanitized tests/PackageInstallTests.cpp)
  target_link_libraries(kalandra-package-install-tests-sanitized PRIVATE kalandra-packages-sanitized)
  target_compile_options(kalandra-package-install-tests-sanitized PRIVATE -Wall -Wextra -Werror -O1 -g -fsanitize=address,undefined -fno-sanitize-recover=all -fno-omit-frame-pointer)
  target_link_options(kalandra-package-install-tests-sanitized PRIVATE -fsanitize=address,undefined -fno-sanitize-recover=all)
  foreach(VARIANT IN ITEMS debug optimized sanitized thread-sanitized)
    set(INSTALL_EXTRA)
    if(VARIANT STREQUAL "debug")
      list(APPEND INSTALL_EXTRA --lsp "$<TARGET_FILE:kalandra-lsp>")
      if(TARGET kalandra-metal-source)
        list(APPEND INSTALL_EXTRA --metal "$<TARGET_FILE:kalandra-metal-source>")
      endif()
    endif()
    add_test(NAME native-package-install-${VARIANT} COMMAND "${KALANDRA_PYTHON3}"
      "${CMAKE_CURRENT_SOURCE_DIR}/tests/PackageInstallFixtures.py"
      --compiler "$<TARGET_FILE:kalandra>" --checker "$<TARGET_FILE:kalandra-check>"
      --variant "${VARIANT}" --root "${CMAKE_CURRENT_BINARY_DIR}/package-install-${VARIANT}" ${INSTALL_EXTRA})
    set_tests_properties(native-package-install-${VARIANT} PROPERTIES TIMEOUT 180)
  endforeach()
  add_test(NAME native-package-install-frontend-sanitized COMMAND "${KALANDRA_PYTHON3}"
    "${CMAKE_CURRENT_SOURCE_DIR}/tests/PackageInstallFixtures.py"
    --compiler "$<TARGET_FILE:kalandra>" --checker "$<TARGET_FILE:kalandra-check-sanitized>"
    --api "$<TARGET_FILE:kalandra-package-install-tests-sanitized>"
    --root "${CMAKE_CURRENT_BINARY_DIR}/package-install-frontend-sanitized")
  set_tests_properties(native-package-install-frontend-sanitized PROPERTIES TIMEOUT 240)
endif()
