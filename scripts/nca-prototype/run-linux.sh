#!/usr/bin/env bash
set -euo pipefail

# Run the canonical Windows checkout through /mnt/c; do not clone/copy sources.
cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.."
[[ "$(uname -s)" == Linux ]] || { echo 'Linux is required' >&2; exit 1; }
: "${NCA_SDK_ROOT:?Set the Linux path to the supplied SDK}"
: "${NCA_JAVA_HOME:?Set the Linux path to a Linux JDK 8}"
: "${NCA_TEST_KEY_PASSWORD:?Set the public SDK test password locally}"
export NCA_DEPENDENCIES="${NCA_DEPENDENCIES:-$PWD/.tmp/nca-prototype/deps}"
command -v node >/dev/null
[[ "$(node -p process.platform)" == linux ]] || { echo 'Use Linux Node, not Windows node.exe' >&2; exit 1; }
[[ -x "$NCA_JAVA_HOME/bin/java" && -x "$NCA_JAVA_HOME/bin/javac" ]] || { echo 'Linux JDK required' >&2; exit 1; }
"$NCA_JAVA_HOME/bin/java" -version

# Only existing synthetic browser receipts are copied, never private keys/sources.
shopt -s nullglob
receipts=(.tmp/nca-prototype/evidence/ncalayer-sign-*.json)
(( ${#receipts[@]} > 0 )) || { echo 'Browser receipts missing' >&2; exit 1; }
mkdir -p .tmp/nca-prototype/linux/evidence
cp -- "${receipts[@]}" .tmp/nca-prototype/linux/evidence/
node scripts/nca-prototype/run.mjs offline
node scripts/nca-prototype/run.mjs verify-browser
node scripts/nca-prototype/run.mjs revocation
# TSP is separate: do not rerun the blocked trust gate automatically.
