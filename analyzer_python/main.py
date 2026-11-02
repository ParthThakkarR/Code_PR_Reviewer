"""FastAPI service that performs lightweight code analysis."""

import asyncio
import os
import tempfile

from fastapi import FastAPI
from pydantic import BaseModel
import uvicorn

app = FastAPI()


class CodeRequest(BaseModel):
    """Request payload containing source code to analyze."""

    code: str


async def run_command(command: list, timeout: int = 10):
    """Execute a subprocess command with timeout control."""

    try:
        process = await asyncio.create_subprocess_exec(
            *command,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )

        stdout, stderr = await asyncio.wait_for(
            process.communicate(),
            timeout=timeout
        )

        return {
            "success": True,
            "output": stdout.decode() + stderr.decode()
        }

    except asyncio.TimeoutError:
        process.kill()
        return {
            "success": False,
            "error": "Command timed out"
        }

    except OSError as err:
        return {
            "success": False,
            "error": str(err)
        }


@app.get("/")
def health_check():
    return {"status": "ok", "service": "python-analyzer"}


@app.post("/analyze")
async def analyze_code(req: CodeRequest):
    """Analyze Python code with lint, security, and complexity tools."""

    # 1. Create temp file
    with tempfile.NamedTemporaryFile(delete=False, suffix=".py") as tmp:
        tmp.write(req.code.encode())
        tmp_path = tmp.name

    try:
        tasks = {
            "pylint": run_command(
                ["pylint", tmp_path, "--disable-all", "--enable=E,W"]
            ),
            "bandit": run_command(
                ["bandit", "-q", "-r", tmp_path]
            ),
            "radon": run_command(
                ["radon", "cc", tmp_path]
            )
        }

        # 3. Execute in parallel
        results = await asyncio.gather(*tasks.values())

        response = {}
        for key, result in zip(tasks.keys(), results):
            response[key] = result

        return {
            "status": "success",
            "analysis": response
        }

    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False)
