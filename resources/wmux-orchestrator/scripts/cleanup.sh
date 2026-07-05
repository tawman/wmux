#!/usr/bin/env bash
# cleanup.sh <orch-dir>
# Remove an orchestration temp directory.
#
# Safety (issue #2 / F-9): refuse to delete anything that is not a wmux-orch-*
# directory living directly under $TMPDIR. A wrong or hostile argument must
# never let this rm -rf an arbitrary path.

ORCH_DIR="$1"
[ -z "$ORCH_DIR" ] && { echo "Usage: cleanup.sh <orch-dir>"; exit 1; }

ORCH_BASE="${TMPDIR:-/tmp}"

# Resolve to an absolute, symlink-free path so a relative arg, "..", or a
# symlink can't smuggle the target outside $TMPDIR. realpath -m tolerates a
# non-existent target (dir may already be gone); fall back to a cd-based
# resolver where realpath is unavailable.
resolve() {
  if command -v realpath >/dev/null 2>&1; then
    realpath -m "$1" 2>/dev/null
  else
    ( cd "$(dirname "$1")" 2>/dev/null && printf '%s/%s\n' "$(pwd -P)" "$(basename "$1")" )
  fi
}

base_real="$(resolve "$ORCH_BASE")"
target_real="$(resolve "$ORCH_DIR")"

if [ -z "$base_real" ] || [ -z "$target_real" ]; then
  echo "cleanup.sh: refusing to delete — could not resolve path: $ORCH_DIR" >&2
  exit 1
fi

target_parent="$(dirname "$target_real")"
target_name="$(basename "$target_real")"

# Must be named wmux-orch-* ...
case "$target_name" in
  wmux-orch-*) ;;
  *)
    echo "cleanup.sh: refusing to delete non-orch path: $target_real" >&2
    exit 1
    ;;
esac

# ... and be a direct child of $TMPDIR (not the base itself, not root).
if [ "$target_parent" != "$base_real" ]; then
  echo "cleanup.sh: refusing to delete path outside \$TMPDIR ($base_real): $target_real" >&2
  exit 1
fi
if [ "$target_real" = "$base_real" ] || [ "$target_real" = "/" ]; then
  echo "cleanup.sh: refusing to delete base/root: $target_real" >&2
  exit 1
fi

[ -d "$target_real" ] && rm -rf "$target_real"
echo "Cleaned up $target_real"
