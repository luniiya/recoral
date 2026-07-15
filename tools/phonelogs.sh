#!/usr/bin/env bash
# Quick adb helpers for the recoral Android app, scoped to just this app's
# process instead of grepping through the whole-phone logcat firehose.
#
# Usage:
#   tools/phonelogs.sh tail              # this app's recent log, EGL noise stripped
#   tools/phonelogs.sh follow            # same, but live (like tail -f)
#   tools/phonelogs.sh console           # JS console.log/console.error only
#   tools/phonelogs.sh crash             # check for a real native crash
#   tools/phonelogs.sh clear             # clear the log buffer before a repro
#   tools/phonelogs.sh screenshot [path] # default: /tmp/recoral-screenshot.png
#   tools/phonelogs.sh install [apk]     # default: mobile/android debug APK
#   tools/phonelogs.sh restart           # force-stop + relaunch the app

set -euo pipefail

export ANDROID_SDK_ROOT="${ANDROID_SDK_ROOT:-$HOME/Android/Sdk-avd}"
export ANDROID_HOME="$ANDROID_SDK_ROOT"
ADB="$ANDROID_SDK_ROOT/platform-tools/adb"
PACKAGE="com.recoral.app"
DEFAULT_APK="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/mobile/android/app/build/outputs/apk/debug/app-debug.apk"

cmd="${1:-tail}"

pid() {
	"$ADB" shell pidof -s "$PACKAGE" 2>/dev/null || true
}

case "$cmd" in
	tail)
		p="$(pid)"
		if [ -z "$p" ]; then
			echo "app not running" >&2
			exit 1
		fi
		"$ADB" logcat --pid="$p" -d | grep -v "EGL_emulation"
		;;
	follow)
		p="$(pid)"
		if [ -z "$p" ]; then
			echo "app not running" >&2
			exit 1
		fi
		"$ADB" logcat --pid="$p" | grep -v --line-buffered "EGL_emulation"
		;;
	console)
		"$ADB" logcat -d -s "Capacitor/Console:*"
		;;
	crash)
		echo "--- crash buffer ---"
		"$ADB" logcat -d -b crash
		echo "--- FATAL EXCEPTION search (main buffer) ---"
		"$ADB" logcat -d | grep -iE "FATAL EXCEPTION|AndroidRuntime|has died|ANR in" \
			|| echo "(none found, process didn't crash at the OS level)"
		;;
	clear)
		"$ADB" logcat -c
		echo "cleared"
		;;
	screenshot)
		out="${2:-/tmp/recoral-screenshot.png}"
		"$ADB" exec-out screencap -p > "$out"
		echo "saved to $out"
		;;
	install)
		apk="${2:-$DEFAULT_APK}"
		"$ADB" install -r "$apk"
		;;
	restart)
		"$ADB" shell am force-stop "$PACKAGE"
		"$ADB" shell am start -n "$PACKAGE/.MainActivity"
		;;
	*)
		echo "usage: $0 {tail|follow|console|crash|clear|screenshot [path]|install [apk]|restart}" >&2
		exit 1
		;;
esac
