#pragma once
#include <filesystem>
#include <map>
#include <string>
void buildMetalProgram(const std::filesystem::path &, const std::map<std::string, std::string> &,
                       const std::string &variant);
