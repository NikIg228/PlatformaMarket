# Keep the installed Expo SDK unchanged. Apply this only to its generated phase.
module MarketUnsignedExpoJSI
  PHASE_NAME = '[CP-User] Build ExpoModulesJSI xcframework'.freeze
  SDK_SCRIPT = '"${PODS_TARGET_SRCROOT}/scripts/build-xcframework.sh"'.freeze
  PREFIX = <<~'SH'.freeze
    # Market: the SDK's nested env -i explicitly preserves this phase's PATH.
    if [ "${PLATFORM_NAME:-}" = "iphonesimulator" ] && [ "${CODE_SIGNING_ALLOWED:-}" = "NO" ]; then
      export PATH="${PODS_ROOT}/../build-tools/unsigned-simulator:${PATH}"
    fi
  SH

  def self.install!(installer)
    targets = installer.pods_project.targets.select { |target| target.name == 'ExpoModulesJSI' }
    raise 'Market: expected exactly one ExpoModulesJSI target; review the SDK integration' unless targets.length == 1

    phases = targets.first.shell_script_build_phases.select { |phase| phase.name == PHASE_NAME }
    raise 'Market: expected exactly one ExpoModulesJSI build phase; review the SDK integration' unless phases.length == 1

    phase = phases.first
    proposed = PREFIX + SDK_SCRIPT
    return if phase.shell_script == proposed
    raise 'Market: ExpoModulesJSI build script changed; review before applying the unsigned simulator hook' unless phase.shell_script == SDK_SCRIPT

    phase.shell_script = proposed
  end
end
