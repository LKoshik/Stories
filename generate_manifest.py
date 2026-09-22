#!/usr/bin/env python3
"""
Regenerates stories.json by scanning the chapters/ folder.

Why this exists:
app.js only ever reads stories.json — it never looks inside chapters/
itself. So every time you add a new chapter .txt file, someone (or
something) has to add a matching entry to stories.json, or the site
just won't show it. This script is that "something": run it and it
rebuilds the whole chapters list for every story from whatever .txt
files actually exist on disk.

Usage:
    python3 generate_manifest.py

Run it from the repo root (same folder as stories.json) any time
after adding, removing, or renaming chapter files, then commit the
updated stories.json along with your chapter files.
"""

import json
import re
from pathlib import Path

# Metadata that can't be inferred from filenames — edit this when you
# add a brand new story, or change a title/genre/description.
STORIES = [
    {
        "slug": "the-weight-of-wings",
        "title": "The Weight of Wings",
        "genre": "Romance",
        "description": (
            "He can create anything. He chooses to earn everything. "
            "She survives for others. Together they begin to learn "
            "what it actually means to live."
        ),
    },
    {
        "slug": "ordinary-light",
        "title": "Ordinary Light",
        "genre": "Slice of life",
        "description": (
            "Two people discovering that ordinary moments can hold "
            "extraordinary amounts of light."
        ),
    },
]

REPO_ROOT = Path(__file__).resolve().parent
CHAPTERS_DIR = REPO_ROOT / "chapters"
MANIFEST_PATH = REPO_ROOT / "stories.json"

CHAPTER_FILE_RE = re.compile(r"^(\d+)\.txt$")


def find_chapters(slug):
    """Scan chapters/<slug>/ and return a sorted list of chapter entries."""
    story_dir = CHAPTERS_DIR / slug
    if not story_dir.is_dir():
        print(f"  ! warning: no folder found at chapters/{slug}/ — skipping")
        return []

    chapters = []
    for path in story_dir.iterdir():
        match = CHAPTER_FILE_RE.match(path.name)
        if not match:
            continue  # ignore stray files that aren't NN.txt
        number = int(match.group(1))
        chapters.append(
            {
                "number": number,
                "title": f"Chapter {number}",
                "file": f"chapters/{slug}/{path.name}",
            }
        )

    chapters.sort(key=lambda c: c["number"])
    return chapters


def main():
    manifest = {"stories": []}

    for story in STORIES:
        slug = story["slug"]
        chapters = find_chapters(slug)
        print(f"{story['title']}: found {len(chapters)} chapter(s)")

        manifest["stories"].append(
            {
                "slug": slug,
                "title": story["title"],
                "genre": story["genre"],
                "description": story["description"],
                "chapters": chapters,
            }
        )

    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(f"\nWrote {MANIFEST_PATH.relative_to(REPO_ROOT)}")


if __name__ == "__main__":
    main()
