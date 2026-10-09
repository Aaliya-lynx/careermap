"""A small SQLite database of saved roadmaps for the demo jobs.

Each row is a real roadmap that the AI wrote earlier and that passed the same checks as any live answer (see build_demo_db.py).
The server shows one of them only when the live AI cannot answer, or when DEMO_MODE=true is set: a backup so that the
demo jobs never fail on a bad network or an empty free quota. The screen says so when a saved roadmap is shown.
"""
import json
import sqlite3
from contextlib import closing
from datetime import datetime, timezone
from pathlib import Path

SCHEMA = """
CREATE TABLE IF NOT EXISTS roadmaps (
    goal_key TEXT PRIMARY KEY,      -- the job, lower case, single spaces: how a typed job is matched
    goal     TEXT NOT NULL,         -- the job as it is shown to people
    kind     TEXT NOT NULL,         -- 'tech' or 'non-tech' (only for the demo script)
    title    TEXT NOT NULL,
    steps    INTEGER NOT NULL,
    roadmap  TEXT NOT NULL,         -- the roadmap as JSON
    known    TEXT NOT NULL,         -- ids of steps the AI judged already known, as JSON
    saved_at TEXT NOT NULL
)
"""


def key_of(goal):
    return " ".join(goal.split()).lower()


def save(path, goal, kind, roadmap, known):
    """Add or replace one saved roadmap (creates the database if it does not exist)."""
    with closing(sqlite3.connect(path)) as db:
        db.execute(SCHEMA)
        db.execute(
            "INSERT OR REPLACE INTO roadmaps VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (key_of(goal), goal.strip(), kind, roadmap.get("title") or goal.strip(), len(roadmap["nodes"]),
             json.dumps(roadmap, ensure_ascii=False), json.dumps(known or [], ensure_ascii=False), datetime.now(timezone.utc).isoformat(timespec="seconds")),
        )
        db.commit()


def lookup(path, goal):
    """{"roadmap": ..., "known": [...]} for a saved job, or None (also None if the database file is missing)."""
    path = Path(path)
    if not path.exists():
        return None
    try:
        with closing(sqlite3.connect(f"{path.as_uri()}?mode=ro", uri=True)) as db:        # read-only: serving never changes the file
            row = db.execute("SELECT roadmap, known FROM roadmaps WHERE goal_key = ?", (key_of(goal),)).fetchone()
    except sqlite3.Error:
        return None
    return {"roadmap": json.loads(row[0]), "known": json.loads(row[1])} if row else None


def jobs(path):
    """What is saved, for the demo script: [(goal, kind, steps)] in alphabetical order."""
    path = Path(path)
    if not path.exists():
        return []
    with closing(sqlite3.connect(f"{path.as_uri()}?mode=ro", uri=True)) as db:
        return db.execute("SELECT goal, kind, steps FROM roadmaps ORDER BY goal COLLATE NOCASE").fetchall()
