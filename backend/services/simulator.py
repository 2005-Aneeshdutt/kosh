"""Background live-payment simulator.

Emits a realistic payment every few seconds so the dashboard is always alive
during a demo. Toggleable at runtime; safe to start/stop repeatedly.
"""
from __future__ import annotations

import asyncio
import random
from typing import Optional

from backend.services.live_data import live


class Simulator:
    def __init__(self) -> None:
        self._task: Optional[asyncio.Task] = None
        self.running = False
        self.min_delay = 4.0
        self.max_delay = 9.0

    async def _loop(self) -> None:
        while self.running:
            await asyncio.sleep(random.uniform(self.min_delay, self.max_delay))
            if not self.running:
                break
            try:
                live.random_live_payment()
            except Exception:  # pragma: no cover - never let the loop die
                pass

    def start(self) -> None:
        if self.running:
            return
        self.running = True
        self._task = asyncio.create_task(self._loop())

    def stop(self) -> None:
        self.running = False
        if self._task:
            self._task.cancel()
            self._task = None

    def status(self) -> dict:
        return {"running": self.running}


simulator = Simulator()
