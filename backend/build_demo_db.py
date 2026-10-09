"""Builds backend/demo_roadmaps.db: the saved roadmaps used as the backup for the demo jobs.

Each job is sent once to the real AI through the app's own /api/roadmap code, so every saved roadmap went through the same checks as a
live answer. Jobs that are already saved are skipped (use --force to ask again).

Run from the backend folder, with at least one provider key in .env:   python build_demo_db.py
"""
import sys
from concurrent.futures import ThreadPoolExecutor

from fastapi.testclient import TestClient

import demo_db
import limiter
import main

# A mix of technical and non-technical jobs, all typed the way a student would type them.
JOBS = [
    ("Full Stack Developer at a climate tech startup", "tech"),
    ("UI/UX Designer for fintech apps", "tech"),
    ("Data Analyst in healthcare", "tech"),
    ("Machine Learning Engineer", "tech"),
    ("Cybersecurity Analyst", "tech"),
    ("Cloud DevOps Engineer", "tech"),
    ("Mobile App Developer", "tech"),
    ("Product Manager at a SaaS startup", "non-tech"),
    ("Digital Marketing Manager", "non-tech"),
    ("Chartered Accountant", "non-tech"),
    ("Human Resources Manager", "non-tech"),
    ("Content Creator", "non-tech"),
    ("Civil Engineer", "non-tech"),
    ("Journalist", "non-tech"),
    ("Financial Analyst at a bank", "non-tech"),
]


def ask_the_ai(goal, tries=3):
    """The roadmap for one job from the real AI, checked like any live answer. Returns (roadmap, known)."""
    main.ai_limiter = limiter.Limiter(per_visitor=1000, overall=1000, window=60)
    last = None
    with TestClient(main.app) as client:
        for _ in range(tries):
            r = client.post("/api/roadmap", json={"goal": goal, "hours_per_week": 8})
            body = r.json()
            if r.status_code == 200 and not body.get("from_cache") and 12 <= len(body["roadmap"]["nodes"]) <= 24:
                return body["roadmap"], body["known"]
            last = f"{r.status_code}: {body.get('detail', 'unexpected answer')}"
    raise RuntimeError(f"{goal}: {last}")


def main_script():
    force = "--force" in sys.argv
    saved = {goal for goal, _, _ in demo_db.jobs(main.DEMO_DB)}
    todo = []
    for goal, kind in JOBS:
        if demo_db.key_of(goal) in {demo_db.key_of(s) for s in saved} and not force:
            print("already saved:", goal)
        else:
            todo.append((goal, kind))
    failures = []

    def one(item):
        goal, kind = item
        try:
            roadmap, known = ask_the_ai(goal)
            demo_db.save(main.DEMO_DB, goal, kind, roadmap, known)
            print(f"asked the AI : {goal} ({len(roadmap['nodes'])} steps)", flush=True)
        except Exception as error:                      # one job failing must not stop the others
            failures.append(str(error))
            print("FAILED       :", error, flush=True)

    with ThreadPoolExecutor(max_workers=4) as pool:
        list(pool.map(one, todo))
    print(f"\n{len(demo_db.jobs(main.DEMO_DB))} jobs saved in {main.DEMO_DB.name}; {len(failures)} failed.")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main_script())
