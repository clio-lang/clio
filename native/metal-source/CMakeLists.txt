add_executable(kalandra-metal-source Compiler.cpp Build.cpp)
target_link_libraries(kalandra-metal-source PRIVATE kalandra-semantics MLIR LLVM)
target_include_directories(kalandra-metal-source SYSTEM PRIVATE ${MLIR_INCLUDE_DIRS} ${LLVM_INCLUDE_DIRS})
target_compile_options(kalandra-metal-source PRIVATE -Wall -Wextra -Werror)
function(add_source_fixture FIXTURE)
set(GENERATED "${CMAKE_CURRENT_BINARY_DIR}/${FIXTURE}")
add_custom_command(OUTPUT "${GENERATED}/host.cpp" "${GENERATED}/kernel0.mlir" "${GENERATED}/manifest.txt"
  COMMAND $<TARGET_FILE:kalandra-metal-source> "${CMAKE_CURRENT_SOURCE_DIR}/${FIXTURE}.kalandra" -o "${GENERATED}"
  DEPENDS kalandra-metal-source "${FIXTURE}.kalandra" VERBATIM)
# Use the same pinned toolchain and strict integer lowering as the numerical proof.
file(READ "${PROJECT_SOURCE_DIR}/native/metal-proof/toolchain.json" SOURCE_LOCK)
foreach(KEY IN ITEMS spirvCrossRoot spirvToolsRoot metalToolchain strictMetalLanguageVersion strictMslVersion)
  string(JSON SOURCE_${KEY} GET "${SOURCE_LOCK}" "${KEY}")
endforeach()
set(BASE "${GENERATED}/kernel0")
add_custom_command(OUTPUT "${BASE}.metallib" "${BASE}.lowered.mlir" "${BASE}.spvasm" "${BASE}.metal" "${BASE}.reflection.json"
  COMMAND $<TARGET_FILE:kalandra-metal-strict> "${BASE}.mlir" "${BASE}.lowered.mlir"
  COMMAND "${KALANDRA_LLVM_ROOT}/bin/mlir-opt" "${BASE}.lowered.mlir" --verify-each
    "--pass-pipeline=builtin.module(canonicalize,cse,convert-gpu-to-spirv,spirv.module(spirv-lower-abi-attrs,spirv-update-vce))" -o "${BASE}.converted.mlir"
  COMMAND $<TARGET_FILE:kalandra-metal-extract> "${BASE}.converted.mlir" "${BASE}.kernel.mlir" --metal-compiler-rounding
  COMMAND "${KALANDRA_LLVM_ROOT}/bin/mlir-translate" --no-implicit-module --serialize-spirv "${BASE}.kernel.mlir" -o "${BASE}.spv"
  COMMAND "${SOURCE_spirvToolsRoot}/bin/spirv-val" --target-env vulkan1.0 "${BASE}.spv"
  COMMAND "${SOURCE_spirvToolsRoot}/bin/spirv-dis" "${BASE}.spv" -o "${BASE}.spvasm"
  COMMAND "${SOURCE_spirvCrossRoot}/bin/spirv-cross" "${BASE}.spv" --reflect --output "${BASE}.reflection.json"
  COMMAND "${SOURCE_spirvCrossRoot}/bin/spirv-cross" "${BASE}.spv" --msl --msl-version "${SOURCE_strictMslVersion}" --output "${BASE}.metal"
  COMMAND xcrun --toolchain "${SOURCE_metalToolchain}" --sdk macosx metal "-std=${SOURCE_strictMetalLanguageVersion}" -fno-fast-math -ffp-contract=off
    "-fmodules-cache-path=${CMAKE_CURRENT_BINARY_DIR}/module-cache" -c "${BASE}.metal" -o "${BASE}.air"
  COMMAND xcrun --toolchain "${SOURCE_metalToolchain}" metal "${BASE}.air" -o "${BASE}.metallib"
  DEPENDS "${BASE}.mlir" kalandra-metal-strict kalandra-metal-extract "${PROJECT_SOURCE_DIR}/native/metal-proof/toolchain.json"
  BYPRODUCTS "${BASE}.converted.mlir" "${BASE}.kernel.mlir" "${BASE}.spv" "${BASE}.air" VERBATIM)
add_custom_target(native-metal-source-shader-${FIXTURE} ALL DEPENDS "${BASE}.metallib")
if(BUILD_TESTING)
  foreach(VARIANT IN ITEMS debug optimized sanitized thread-sanitized)
    add_executable(kalandra-metal-source-${FIXTURE}-${VARIANT} SourceTests.cpp)
    if(VARIANT STREQUAL "sanitized")
      set(FLAGS -O1 -g -fsanitize=address,undefined -fno-sanitize-recover=all -fno-omit-frame-pointer)
    elseif(VARIANT STREQUAL "thread-sanitized")
      set(FLAGS -O1 -g -fsanitize=thread -fno-omit-frame-pointer)
    elseif(VARIANT STREQUAL "optimized")
      set(FLAGS -O2)
    else()
      set(FLAGS -O0)
    endif()
    target_include_directories(kalandra-metal-source-${FIXTURE}-${VARIANT} PRIVATE ../metal "${GENERATED}")
    target_compile_options(kalandra-metal-source-${FIXTURE}-${VARIANT} PRIVATE -Wall -Wextra -Werror ${FLAGS})
    target_link_options(kalandra-metal-source-${FIXTURE}-${VARIANT} PRIVATE ${FLAGS})
    target_link_libraries(kalandra-metal-source-${FIXTURE}-${VARIANT} PRIVATE kalandra-metal-${VARIANT} LLVM)
    target_include_directories(kalandra-metal-source-${FIXTURE}-${VARIANT} SYSTEM PRIVATE ${LLVM_INCLUDE_DIRS})
    if(FIXTURE STREQUAL "composed")
      target_compile_definitions(kalandra-metal-source-${FIXTURE}-${VARIANT} PRIVATE KALANDRA_SOURCE_COMPOSED)
    endif()
    add_dependencies(kalandra-metal-source-${FIXTURE}-${VARIANT} native-metal-source-shader-${FIXTURE})
    add_test(NAME native-metal-source-${FIXTURE}-${VARIANT} COMMAND kalandra-metal-source-${FIXTURE}-${VARIANT} "${GENERATED}")
    set_tests_properties(native-metal-source-${FIXTURE}-${VARIANT} PROPERTIES TIMEOUT 90 RESOURCE_LOCK apple-metal-gpu
      ENVIRONMENT "MTL_DEBUG_LAYER=1" )
  endforeach()
endif()

endfunction()
add_source_fixture(placed)
add_source_fixture(composed)
if(BUILD_TESTING)
  add_executable(kalandra-metal-source-compiler-sanitized Compiler.cpp Build.cpp)
  target_link_libraries(kalandra-metal-source-compiler-sanitized PRIVATE kalandra-semantics-sanitized MLIR LLVM)
  target_include_directories(kalandra-metal-source-compiler-sanitized SYSTEM PRIVATE ${MLIR_INCLUDE_DIRS} ${LLVM_INCLUDE_DIRS})
  target_compile_options(kalandra-metal-source-compiler-sanitized PRIVATE -Wall -Wextra -Werror -O1 -g
    -fsanitize=address,undefined -fno-sanitize-recover=all -fno-omit-frame-pointer)
  target_link_options(kalandra-metal-source-compiler-sanitized PRIVATE -fsanitize=address,undefined)
  foreach(COMPILER_TARGET IN ITEMS kalandra-metal-source kalandra-metal-source-compiler-sanitized)
    add_test(NAME ${COMPILER_TARGET}-diagnostics COMMAND "${CMAKE_COMMAND}" "-DCOMPILER=$<TARGET_FILE:${COMPILER_TARGET}>"
      "-DCPU_CHECKER=$<TARGET_FILE:kalandra-check>" "-DOUTPUT_DIR=${CMAKE_CURRENT_BINARY_DIR}/${COMPILER_TARGET}-checks"
      "-DSOURCE_DIR=${CMAKE_CURRENT_SOURCE_DIR}" -P "${CMAKE_CURRENT_SOURCE_DIR}/VerifyRejected.cmake")
    set_tests_properties(${COMPILER_TARGET}-diagnostics PROPERTIES TIMEOUT 90)
  endforeach()
endif()
if(BUILD_TESTING)
  add_test(NAME native-metal-source-artifacts COMMAND "${CMAKE_COMMAND}"
    "-DOUTPUT_DIR=${CMAKE_CURRENT_BINARY_DIR}" -P "${CMAKE_CURRENT_SOURCE_DIR}/VerifyArtifacts.cmake")
endif()

set(TOOLCHAIN_HEADER "#pragma once\n")
foreach(PAIR IN ITEMS
    "CLANG|${CMAKE_CXX_COMPILER}" "OPT|${KALANDRA_LLVM_ROOT}/bin/mlir-opt"
    "TRANSLATE|${KALANDRA_LLVM_ROOT}/bin/mlir-translate"
    "STRICT|$<TARGET_FILE:kalandra-metal-strict>" "EXTRACT|$<TARGET_FILE:kalandra-metal-extract>"
    "CROSS|${KALANDRA_SPIRV_CROSS_ROOT}/bin/spirv-cross" "VALIDATE|${KALANDRA_SPIRV_TOOLS_ROOT}/bin/spirv-val"
    "METAL_TOOLCHAIN|${KALANDRA_METAL_TOOLCHAIN}" "INCLUDE|${PROJECT_SOURCE_DIR}/native/metal"
    "METAL_DEBUG|$<TARGET_FILE:kalandra-metal-debug>" "CORE_DEBUG|$<TARGET_FILE:kalandra-native-runtime>"
    "METAL_OPTIMIZED|$<TARGET_FILE:kalandra-metal-optimized>" "CORE_OPTIMIZED|$<TARGET_FILE:kalandra-task-core-optimized>"
    "METAL_SANITIZED|$<TARGET_FILE:kalandra-metal-sanitized>" "CORE_SANITIZED|$<TARGET_FILE:kalandra-native-runtime-sanitized>"
    "METAL_THREAD_SANITIZED|$<TARGET_FILE:kalandra-metal-thread-sanitized>" "CORE_THREAD_SANITIZED|$<TARGET_FILE:kalandra-native-runtime-thread-sanitized>")
  string(REPLACE "|" ";" PARTS "${PAIR}")
  list(GET PARTS 0 KEY)
  list(GET PARTS 1 VALUE)
  string(APPEND TOOLCHAIN_HEADER "#define KALANDRA_GPU_${KEY} \"${VALUE}\"\n")
endforeach()
file(GENERATE OUTPUT "${CMAKE_CURRENT_BINARY_DIR}/Toolchain.h" CONTENT "${TOOLCHAIN_HEADER}")
target_include_directories(kalandra-metal-source PRIVATE "${CMAKE_CURRENT_BINARY_DIR}")
add_dependencies(kalandra-metal-source kalandra-metal-strict kalandra-metal-extract
  kalandra-metal-debug kalandra-metal-optimized kalandra-metal-sanitized kalandra-metal-thread-sanitized)
if(BUILD_TESTING)
  target_include_directories(kalandra-metal-source-compiler-sanitized PRIVATE "${CMAKE_CURRENT_BINARY_DIR}")
endif()
if(BUILD_TESTING)
  add_test(NAME native-metal-source-cli-build COMMAND "${CMAKE_COMMAND}"
    "-DCOMPILER=$<TARGET_FILE:kalandra-metal-source>" "-DSOURCE_DIR=${CMAKE_CURRENT_SOURCE_DIR}"
    "-DOUTPUT_DIR=${CMAKE_CURRENT_BINARY_DIR}" -P "${CMAKE_CURRENT_SOURCE_DIR}/VerifyBuild.cmake")
  set_tests_properties(native-metal-source-cli-build PROPERTIES TIMEOUT 120 RESOURCE_LOCK apple-metal-gpu ENVIRONMENT "MTL_DEBUG_LAYER=1")
endif()
