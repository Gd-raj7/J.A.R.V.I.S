import re
import os
import subprocess
import sys
import webbrowser


# Only explicitly approved applications can be opened.
ALLOWED_APPS = {
    "notepad": ["notepad.exe"],
    "calculator": ["calc.exe"],
    "paint": ["mspaint.exe"],
}


def open_application(app_name: str) -> dict:
    """Open an approved Windows application."""
    name = app_name.strip().lower()

    if name not in ALLOWED_APPS:
        return {
            "success": False,
            "message": (
                f"{app_name} is not an approved app. "
                f"Allowed apps: {', '.join(ALLOWED_APPS)}"
            ),
        }

    try:
        subprocess.Popen(
            ALLOWED_APPS[name],
            shell=False,
        )
        return {
            "success": True,
            "message": f"Opening {name}.",
        }
    except OSError as exc:
        return {
            "success": False,
            "message": f"Could not open {name}: {exc}",
        }


def open_website(site_name: str) -> dict:
    """Open one of a small set of approved websites."""
    websites = {
        "google": "https://www.google.com",
        "youtube": "https://www.youtube.com",
        "github": "https://github.com",
    }

    name = site_name.strip().lower()

    if name not in websites:
        return {
            "success": False,
            "message": "Website not in the approved list.",
        }

    try:
        webbrowser.open(websites[name])
        return {
            "success": True,
            "message": f"Opening {name}.",
        }
    except Exception:
        return {
            "success": False,
            "message": f"Could not open {name}.",
        }


def match_desktop_command(text: str):
    """Return an approved action only for recognized phrases."""
    command = re.sub(r"[^\w\s]", "", text.lower())
    command = re.sub(r"\s+", " ", command).strip()

    commands = {
        "open notepad": ("app", "notepad"),
        "jarvis open notepad": ("app", "notepad"),
        "open calculator": ("app", "calculator"),
        "jarvis open calculator": ("app", "calculator"),
        "open paint": ("app", "paint"),
        "jarvis open paint": ("app", "paint"),
        "open google": ("website", "google"),
        "jarvis open google": ("website", "google"),
        "open youtube": ("website", "youtube"),
        "jarvis open youtube": ("website", "youtube"),
        "open github": ("website", "github"),
        "jarvis open github": ("website", "github"),
    }

    return commands.get(command)

