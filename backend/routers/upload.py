"""Reconciliation endpoints: upload a bank statement + fetch results."""
from __future__ import annotations

from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import PlainTextResponse

from backend.agents.recon_agent import build_summary, reconcile
from backend.agents.store import store
from backend.models.schemas import ReconEntry, ReconResult, UploadResponse
from backend.razorpay_client.client import get_client
from backend.services import invoice_parser

router = APIRouter(prefix="/api/reconciliation", tags=["reconciliation"])


def _to_result(recon: dict) -> ReconResult:
    return ReconResult(
        ran=recon.get("ran", False),
        summary=recon.get("summary", ""),
        total_bank_entries=recon.get("total_bank_entries", 0),
        total_settlements=recon.get("total_settlements", 0),
        matched=recon.get("matched", 0),
        match_rate=recon.get("match_rate", 0.0),
        total_matched_amount=recon.get("total_matched_amount", 0),
        entries=[ReconEntry(**e) for e in recon.get("entries", [])],
    )


@router.post("/upload", response_model=UploadResponse)
async def upload_statement(file: UploadFile = File(...)) -> UploadResponse:
    content = await file.read()
    rows = invoice_parser.parse_statement(file.filename or "statement.csv", content)
    if not rows:
        raise HTTPException(status_code=400, detail="Could not parse any rows from the file.")

    store.set_bank_entries(rows)
    settlements = get_client().fetch_settlements()
    recon = reconcile(rows, settlements)
    recon["summary"] = build_summary(recon)
    store.last_recon = recon

    return UploadResponse(
        filename=file.filename or "statement.csv",
        rows_parsed=len(rows),
        recon=_to_result(recon),
    )


@router.get("/results", response_model=ReconResult)
def results() -> ReconResult:
    recon = store.last_recon
    if not recon:
        return ReconResult(
            ran=False,
            summary="No bank statement uploaded yet.",
            total_bank_entries=0,
            total_settlements=0,
            matched=0,
            match_rate=0.0,
            total_matched_amount=0,
            entries=[],
        )
    return _to_result(recon)


@router.get("/sample")
def sample_statement() -> dict:
    """Return the demo bank statement as CSV text (handy for the demo)."""
    from backend.razorpay_client import mock_data

    return {"filename": "sample_bank_statement.csv", "csv": mock_data.sample_bank_statement_csv()}


@router.get("/sample.csv")
def sample_statement_download() -> PlainTextResponse:
    """Download the demo bank statement as a real .csv file."""
    from backend.razorpay_client import mock_data

    return PlainTextResponse(
        mock_data.sample_bank_statement_csv(),
        headers={"Content-Disposition": "attachment; filename=kosh_sample_bank_statement.csv"},
        media_type="text/csv",
    )
