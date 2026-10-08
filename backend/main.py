"""CareerMap API.

POST /api/plan  : re-plan a roadmap (plain code, no AI, instant)
GET  /health
The AI routes (/api/roadmap and /api/node-advice) are added in the next phase.
"""
import os
from typing import List, Optional

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

import planner
import roadmap

app = FastAPI(title="CareerMap API")

# Frontend origins allowed to call this API: FRONTEND_ORIGINS (comma-separated, no trailing slash, no spaces).
origins = os.getenv("FRONTEND_ORIGINS", "http://localhost:5173").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in origins],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok"}


class PlanRequest(BaseModel):
    nodes: List[dict] = Field(max_length=60)
    known: List[str] = Field(default=[], max_length=60)
    hours_per_week: float = Field(default=8, ge=0, le=500)
    weeks_budget: Optional[int] = Field(default=None, ge=1, le=520)


@app.post("/api/plan")
def plan(req: PlanRequest):
    """Re-plan from the browser's copy of the roadmap. The nodes are cleaned again: the browser is not trusted either."""
    try:
        cleaned = roadmap.clean_roadmap({"nodes": req.nodes})
    except roadmap.RoadmapError:
        return JSONResponse(status_code=422, content={"detail": "That roadmap could not be read."})
    known = roadmap.clean_known(req.known, cleaned["nodes"])
    return {"nodes": cleaned["nodes"], "known": known,
            "plan": planner.plan(cleaned["nodes"], known, req.hours_per_week, req.weeks_budget)}
