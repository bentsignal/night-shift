const fs = require("node:fs");
const path = require("node:path");
const { withDangerousMod } = require("expo/config-plugins");

const DEPLOYMENT_TARGET = "16.4";
const MARKER = "night shift force iOS pods deployment target";

function patchPodfile(contents) {
  if (contents.includes(MARKER)) return contents;
  const lines = contents.split("\n");
  const start = lines.findIndex((line) =>
    line.includes("post_install do |installer|"),
  );
  if (start < 0) throw new Error("Could not find post_install in Podfile");

  let depth = 1;
  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    if (/\bdo(\s*\|.*\|)?\s*$/.test(line.trim())) depth += 1;
    if (/^\s*end\s*$/.test(line)) {
      depth -= 1;
      if (depth === 0) {
        lines.splice(
          index,
          0,
          `  # ${MARKER}`,
          "  installer.pods_project.targets.each do |target|",
          "    target.build_configurations.each do |config|",
          `      config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '${DEPLOYMENT_TARGET}'`,
          "    end",
          "  end",
        );
        return lines.join("\n");
      }
    }
  }
  throw new Error("Could not find end of post_install in Podfile");
}

module.exports = function withIosPodsDeploymentTarget(config) {
  return withDangerousMod(config, [
    "ios",
    (config) => {
      const podfilePath = path.join(
        config.modRequest.platformProjectRoot,
        "Podfile",
      );
      fs.writeFileSync(
        podfilePath,
        patchPodfile(fs.readFileSync(podfilePath, "utf8")),
      );
      return config;
    },
  ]);
};
