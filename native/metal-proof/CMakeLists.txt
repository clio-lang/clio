file(READ "${CMAKE_CURRENT_SOURCE_DIR}/toolchain.json" METAL_LOCK)
foreach(KEY IN ITEMS spirvCrossRoot spirvToolsRoot metalToolchain metalCompilerVersion metalLanguageVersion mslVersion)
  string(JSON LOCK_${KEY} GET "${METAL_LOCK}" "${KEY}")
endforeach()
set(KALANDRA_SPIRV_CROSS_ROOT "${LOCK_spirvCrossRoot}" CACHE PATH "Pinned SPIRV-Cross")
set(KALANDRA_SPIRV_TOOLS_ROOT "${LOCK_spirvToolsRoot}" CACHE PATH "Pinned SPIRV-Tools")
set(KALANDRA_METAL_TOOLCHAIN "${LOCK_metalToolchain}" CACHE STRING "Apple Metal toolchain identifier")
set(CROSS "${KALANDRA_SPIRV_CROSS_ROOT}/bin/spirv-cross")
set(VALIDATOR "${KALANDRA_SPIRV_TOOLS_ROOT}/bin/spirv-val")
set(DISASSEMBLER "${KALANDRA_SPIRV_TOOLS_ROOT}/bin/spirv-dis")
foreach(TOOL IN ITEMS "${CROSS}" "${VALIDATOR}" "${DISASSEMBLER}")
  if(NOT EXISTS "${TOOL}")
    message(FATAL_ERROR "Metal proof dependency missing: ${TOOL}; see native/metal-proof/README.md")
  endif()
endforeach()
execute_process(COMMAND xcrun --toolchain "${KALANDRA_METAL_TOOLCHAIN}" metal --version
  OUTPUT_VARIABLE METAL_VERSION ERROR_VARIABLE METAL_ERROR RESULT_VARIABLE STATUS)
if(NOT STATUS EQUAL 0 OR NOT METAL_VERSION MATCHES "Apple metal version ${LOCK_metalCompilerVersion}")
  message(FATAL_ERROR "Pinned Metal compiler unavailable: ${METAL_VERSION}${METAL_ERROR}")
endif()
execute_process(COMMAND "${CROSS}" --revision OUTPUT_VARIABLE CROSS_VERSION ERROR_VARIABLE CROSS_ERROR)
execute_process(COMMAND "${VALIDATOR}" --version OUTPUT_VARIABLE VALIDATOR_VERSION)
file(WRITE "${CMAKE_CURRENT_BINARY_DIR}/versions.txt"
  "LLVM/MLIR/Clang ${KALANDRA_LLVM_VERSION}\n${METAL_VERSION}${CROSS_VERSION}${CROSS_ERROR}${VALIDATOR_VERSION}")
add_executable(kalandra-metal-extract Extract.cpp)
target_include_directories(kalandra-metal-extract SYSTEM PRIVATE ${MLIR_INCLUDE_DIRS} ${LLVM_INCLUDE_DIRS})
target_link_libraries(kalandra-metal-extract PRIVATE MLIR LLVM)
target_compile_options(kalandra-metal-extract PRIVATE -Wall -Wextra -Werror)
set(MLIR_OPT "${KALANDRA_LLVM_ROOT}/bin/mlir-opt")
set(MLIR_TRANSLATE "${KALANDRA_LLVM_ROOT}/bin/mlir-translate")
set(OUT "${CMAKE_CURRENT_BINARY_DIR}")
add_custom_command(OUTPUT "${OUT}/converted.mlir"
  COMMAND "${MLIR_OPT}" "${CMAKE_CURRENT_SOURCE_DIR}/elementwise.mlir" --verify-each
    "--pass-pipeline=builtin.module(convert-gpu-to-spirv,spirv.module(spirv-lower-abi-attrs,spirv-update-vce))"
    -o "${OUT}/converted.mlir"
  DEPENDS elementwise.mlir toolchain.json VERBATIM)
set(OUTPUTS)
foreach(ROUNDING_POLICY IN ITEMS decorated compiler-rounding)
  set(ROUNDING_OPTION)
  if(ROUNDING_POLICY STREQUAL "compiler-rounding")
    set(ROUNDING_OPTION --metal-compiler-rounding)
  endif()
  set(BASE "${OUT}/${ROUNDING_POLICY}")
  add_custom_command(OUTPUT "${BASE}.metallib" "${BASE}.reflection.json" "${BASE}.spvasm" "${BASE}.metal"
    COMMAND $<TARGET_FILE:kalandra-metal-extract> "${OUT}/converted.mlir" "${BASE}.mlir" ${ROUNDING_OPTION}
    COMMAND "${MLIR_TRANSLATE}" --no-implicit-module --serialize-spirv "${BASE}.mlir" -o "${BASE}.spv"
    COMMAND "${VALIDATOR}" --target-env vulkan1.0 "${BASE}.spv"
    COMMAND "${DISASSEMBLER}" "${BASE}.spv" -o "${BASE}.spvasm"
    COMMAND "${CROSS}" "${BASE}.spv" --reflect --output "${BASE}.reflection.json"
    COMMAND "${CROSS}" "${BASE}.spv" --msl --msl-version "${LOCK_mslVersion}" --output "${BASE}.metal"
    COMMAND xcrun --toolchain "${KALANDRA_METAL_TOOLCHAIN}" --sdk macosx metal
      "-std=${LOCK_metalLanguageVersion}" -fno-fast-math -ffp-contract=off
      "-fmodules-cache-path=${OUT}/module-cache" -c "${BASE}.metal" -o "${BASE}.air"
    COMMAND xcrun --toolchain "${KALANDRA_METAL_TOOLCHAIN}" metal "${BASE}.air" -o "${BASE}.metallib"
    DEPENDS "${OUT}/converted.mlir" kalandra-metal-extract toolchain.json
    BYPRODUCTS "${BASE}.mlir" "${BASE}.spv" "${BASE}.air" VERBATIM)
  list(APPEND OUTPUTS "${BASE}.metallib" "${BASE}.reflection.json" "${BASE}.spvasm" "${BASE}.metal")
endforeach()
foreach(VARIANT IN ITEMS debug optimized sanitized)
  if(VARIANT STREQUAL "debug")
    set(FLAGS -O0)
  elseif(VARIANT STREQUAL "optimized")
    set(FLAGS -O2)
  else()
    set(FLAGS -O1 -g -fsanitize=address,undefined -fno-sanitize-recover=all -fno-omit-frame-pointer)
  endif()
  set(BINARY "${OUT}/metal-proof-${VARIANT}")
  add_custom_command(OUTPUT "${BINARY}"
    COMMAND "${CMAKE_CXX_COMPILER}" -std=c++23 -Wall -Wextra -Werror ${FLAGS}
      -ffp-contract=off -fobjc-arc -fblocks "${CMAKE_CURRENT_SOURCE_DIR}/Harness.mm"
      -framework Foundation -framework Metal -o "${BINARY}"
    DEPENDS Harness.mm VERBATIM)
  list(APPEND OUTPUTS "${BINARY}")
  if(BUILD_TESTING)
    foreach(ROUNDING_POLICY IN ITEMS decorated compiler-rounding)
      add_test(NAME "metal-proof-${ROUNDING_POLICY}-${VARIANT}" COMMAND "${BINARY}"
        "${OUT}/${ROUNDING_POLICY}.metallib" "${OUT}/${ROUNDING_POLICY}-${VARIANT}.json")
      set_tests_properties("metal-proof-${ROUNDING_POLICY}-${VARIANT}" PROPERTIES
        TIMEOUT 60 RESOURCE_LOCK apple-metal-gpu ENVIRONMENT "MTL_DEBUG_LAYER=1")
    endforeach()
  endif()
endforeach()
add_custom_target(native-metal-proof ALL DEPENDS ${OUTPUTS})
if(BUILD_TESTING)
  add_test(NAME metal-proof-artifacts COMMAND "${CMAKE_COMMAND}" "-DOUTPUT_DIR=${OUT}"
    -P "${CMAKE_CURRENT_SOURCE_DIR}/VerifyArtifacts.cmake")
  add_test(NAME metal-proof-extract-errors COMMAND "${CMAKE_COMMAND}"
    "-DEXTRACTOR=$<TARGET_FILE:kalandra-metal-extract>" "-DOUTPUT_DIR=${OUT}"
    -P "${CMAKE_CURRENT_SOURCE_DIR}/VerifyRejected.cmake")
endif()
