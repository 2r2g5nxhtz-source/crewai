from __future__ import annotations

import os
from pathlib import Path
from typing import Any

from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field


BASE_DIR = Path(__file__).resolve().parent
FRONTEND_DIR = BASE_DIR.parent / "frontend"

app = FastAPI(title="PWA Safari Voice Starter")


class AgentRequest(BaseModel):
    request_id: str = Field(..., description="Idempotency key from frontend")
    source: str = Field(default="safari-pwa")
    command: str
    sent_at: str | None = None


def run_crewai(command: str) -> str:
    """
    Runs a minimal CrewAI flow when CREWAI_REAL_MODE=1.
    Falls back to deterministic demo response otherwise.
    """
    real_mode = os.getenv("CREWAI_REAL_MODE", "0") == "1"
    if not real_mode:
        return f"[demo-mode] Command accepted: {command}"

    try:
        from crewai import Agent, Crew, Process, Task
    except Exception as exc:  # pragma: no cover
        return f"[demo-mode] CrewAI import failed, fallback response. Error: {exc}"

    agent = Agent(
        role="Voice Command Planner",
        goal="Convert short voice commands into actionable plans.",
        backstory="A concise assistant that creates clear next actions.",
        verbose=False,
    )

    task = Task(
        description=f"Process this voice command: {command}",
        expected_output="A compact action plan with 3 bullet points.",
        agent=agent,
    )

    crew = Crew(agents=[agent], tasks=[task], process=Process.sequential)
    result = crew.kickoff()
    return str(result)


@app.post("/api/agent")
def post_agent(payload: AgentRequest) -> dict[str, Any]:
    text = run_crewai(payload.command)
    return {
        "success": True,
        "request_id": payload.request_id,
        "source": payload.source,
        "response": text,
    }


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/")
def index() -> FileResponse:
    return FileResponse(FRONTEND_DIR / "index.html")


app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="static")
