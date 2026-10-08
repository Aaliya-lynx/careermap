"""A small in-memory request limiter that protects the AI budget.

Each visitor gets `per_visitor` AI requests per `window` seconds, and the whole app gets `overall`.
Requests that are blocked are not counted, so a flood cannot use up everyone else's share.
It lives in one process's memory, which is enough for a single free server.
"""
import time
from collections import deque


class Limiter:
    def __init__(self, per_visitor=8, overall=60, window=60, clock=time.monotonic):
        self.per_visitor, self.overall, self.window, self.clock = per_visitor, overall, window, clock
        self.hits = {}            # visitor -> times of recent allowed requests
        self.recent = deque()     # times of recent allowed requests, everyone together

    def allow(self, visitor):
        now = self.clock()
        cutoff = now - self.window
        while self.recent and self.recent[0] <= cutoff:
            self.recent.popleft()
        for key in [k for k, times in self.hits.items() if not times or times[-1] <= cutoff]:
            del self.hits[key]    # forget visitors who have been quiet for a whole window

        mine = self.hits.setdefault(visitor, deque())
        while mine and mine[0] <= cutoff:
            mine.popleft()
        if len(mine) >= self.per_visitor or len(self.recent) >= self.overall:
            if not mine:
                del self.hits[visitor]
            return False
        mine.append(now)
        self.recent.append(now)
        return True


def client_id(forwarded_for, direct_host):
    """Who is calling? Behind the host's proxy the real address is the first one in X-Forwarded-For."""
    first = (forwarded_for or "").split(",")[0].strip()
    return first or direct_host or "unknown"
