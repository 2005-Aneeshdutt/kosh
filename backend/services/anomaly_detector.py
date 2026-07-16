"""Z-score based anomaly detection over daily payment metrics."""
from __future__ import annotations

import statistics
from typing import Any


def _z(value: float, series: list[float]) -> float:
    if len(series) < 2:
        return 0.0
    mean = statistics.mean(series)
    stdev = statistics.pstdev(series)
    if stdev == 0:
        return 0.0
    return (value - mean) / stdev


def detect(metrics: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Compare the most recent day against the trailing window.

    Flags success-rate drops and volume spikes/drops with |z| > ~1.5.
    Returns a list of anomaly dicts (possibly empty).
    """
    if len(metrics) < 3:
        return []

    history = metrics[:-1]
    current = metrics[-1]
    anomalies: list[dict[str, Any]] = []

    # Success-rate drop.
    sr_series = [m["success_rate"] for m in history]
    sr_now = current["success_rate"]
    sr_z = _z(sr_now, sr_series)
    expected_sr = round(statistics.mean(sr_series), 4)
    if sr_z <= -1.5 or (expected_sr - sr_now) >= 0.05:
        anomalies.append(
            {
                "type": "success_rate_drop",
                "severity": "critical" if sr_now < 0.88 else "warning",
                "metric": "overall_success_rate",
                "current_value": round(sr_now, 4),
                "expected_value": expected_sr,
                "z_score": round(sr_z, 2),
                "message": (
                    f"Payment success rate {sr_now * 100:.1f}% vs "
                    f"{expected_sr * 100:.1f}% expected"
                ),
                "timestamp": current["timestamp"],
            }
        )

    # Volume swing.
    vol_series = [m["total_payments"] for m in history]
    vol_now = current["total_payments"]
    vol_z = _z(vol_now, vol_series)
    if vol_z >= 2.0:
        anomalies.append(_volume_anomaly("volume_spike", vol_now, vol_series, vol_z, current))
    elif vol_z <= -2.0:
        anomalies.append(_volume_anomaly("volume_drop", vol_now, vol_series, vol_z, current))

    return anomalies


def _volume_anomaly(kind, vol_now, series, z, current) -> dict[str, Any]:
    expected = round(statistics.mean(series), 1)
    direction = "spiked" if kind == "volume_spike" else "dropped"
    return {
        "type": kind,
        "severity": "warning",
        "metric": "payment_volume",
        "current_value": vol_now,
        "expected_value": expected,
        "z_score": round(z, 2),
        "message": f"Payment volume {direction} to {vol_now} vs {expected:.0f} typical",
        "timestamp": current["timestamp"],
    }


def method_failure_breakdown(payments: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    """Per-method success stats and top failure reasons across recent payments."""
    by_method: dict[str, dict[str, Any]] = {}
    for p in payments:
        m = by_method.setdefault(
            p["method"], {"total": 0, "success": 0, "failed": 0, "reasons": {}}
        )
        m["total"] += 1
        if p["status"] == "captured":
            m["success"] += 1
        elif p["status"] == "failed":
            m["failed"] += 1
            reason = p.get("failure_reason") or "unknown"
            m["reasons"][reason] = m["reasons"].get(reason, 0) + 1
    for m in by_method.values():
        m["success_rate"] = round(m["success"] / m["total"], 4) if m["total"] else 0.0
    return by_method
