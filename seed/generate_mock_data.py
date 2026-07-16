"""Generate the demo dataset + sample bank statement to disk.

Usage (from repo root):
    python -m seed.generate_mock_data
"""
from __future__ import annotations

import json
import os
import sys

# Allow running as a plain script.
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.razorpay_client import mock_data  # noqa: E402

OUT_DIR = os.path.dirname(os.path.abspath(__file__))


def main() -> None:
    payments = mock_data.generate_payments()
    invoices = mock_data.generate_invoices()
    settlements = mock_data.generate_settlements()
    metrics = mock_data.generate_payment_metrics()

    with open(os.path.join(OUT_DIR, "mock_dataset.json"), "w", encoding="utf-8") as f:
        json.dump(
            {
                "merchant": {"id": mock_data.MERCHANT_ID, "name": mock_data.MERCHANT_NAME},
                "payments": payments,
                "invoices": invoices,
                "settlements": settlements,
                "payment_metrics": metrics,
            },
            f,
            indent=2,
        )

    with open(os.path.join(OUT_DIR, "sample_bank_statement.csv"), "w", encoding="utf-8") as f:
        f.write(mock_data.sample_bank_statement_csv())

    overdue = sum(1 for i in invoices if i["status"] == "overdue")
    print(f"Wrote {len(payments)} payments, {len(invoices)} invoices "
          f"({overdue} overdue), {len(settlements)} settlements.")
    print("Wrote seed/mock_dataset.json and seed/sample_bank_statement.csv")


if __name__ == "__main__":
    main()
