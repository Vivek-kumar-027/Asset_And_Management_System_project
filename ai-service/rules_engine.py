from datetime import datetime, timezone
from typing import List, Dict, Any, Optional

DEFAULT_TEMPERATURE_THRESHOLDS = {
    "HVAC": 50.0,
    "Generator": 85.0,
    "Pump": 65.0,
    "Lift": 50.0,
    "Other": 60.0,
}

SEVERITY_RANKS = {
    "Healthy": 0,
    "Watch": 1,
    "Critical": 2,
}

def parse_iso_datetime(dt_input: Any) -> Optional[datetime]:
    if not dt_input:
        return None
    if isinstance(dt_input, datetime):
        if dt_input.tzinfo is None:
            return dt_input.replace(tzinfo=timezone.utc)
        return dt_input
    if isinstance(dt_input, str):
        cleaned = dt_input.replace("Z", "+00:00")
        try:
            parsed = datetime.fromisoformat(cleaned)
            if parsed.tzinfo is None:
                parsed = parsed.replace(tzinfo=timezone.utc)
            return parsed
        except Exception:
            return None
    return None

def evaluate_asset_health(
    asset: Dict[str, Any],
    readings: List[Dict[str, Any]],
    current_time: Optional[datetime] = None,
    custom_temp_thresholds: Optional[Dict[str, float]] = None,
) -> Dict[str, Any]:
    """
    Evaluates asset health based on explainable Rules 1-4 from spec.md Section 6.
    Status is computed as the highest severity triggered across all rules.
    """
    now = current_time or datetime.now(timezone.utc)
    if now.tzinfo is None:
        now = now.replace(tzinfo=timezone.utc)

    asset_name = asset.get("name", "Asset")
    asset_type = asset.get("type", "Other")
    maintenance_interval_days = asset.get("maintenanceIntervalDays") or 90
    last_serviced_date = parse_iso_datetime(asset.get("lastServicedDate"))
    installed_date = parse_iso_datetime(asset.get("installedDate"))

    temp_thresholds = {**DEFAULT_TEMPERATURE_THRESHOLDS, **(custom_temp_thresholds or {})}
    max_safe_temp = temp_thresholds.get(asset_type, 60.0)

    # Clean and sort readings ascending by timestamp
    valid_readings = []
    for r in readings:
        ts = parse_iso_datetime(r.get("timestamp"))
        if ts:
            valid_readings.append({
                "timestamp": ts,
                "temperature": float(r["temperature"]) if r.get("temperature") is not None else None,
                "runtimeHours": float(r["runtimeHours"]) if r.get("runtimeHours") is not None else 0.0,
                "errorCode": str(r["errorCode"]).strip() if r.get("errorCode") else None,
            })
    valid_readings.sort(key=lambda x: x["timestamp"])

    reasons: List[str] = []
    rule_explanations: List[str] = []
    rule_statuses: List[str] = ["Healthy"]

    # ==========================================
    # RULE 1 — Runtime deviation
    # ==========================================
    # Compare the asset's runtime over trailing 7 days to its trailing 30-day baseline daily average.
    # >25% above average -> Watch ('runtime_deviation')
    # >50% above average -> Critical ('runtime_deviation_severe')
    # ==========================================
    cutoff_30d = now.timestamp() - (30 * 86400)
    cutoff_7d = now.timestamp() - (7 * 86400)

    # 7-day trailing window
    readings_7d = [r for r in valid_readings if r["timestamp"].timestamp() >= cutoff_7d]

    # Baseline window: readings prior to the 7-day window (up to 30 days back from 7d cutoff, or prior to 7d)
    cutoff_baseline_start = now.timestamp() - (37 * 86400)
    readings_baseline = [r for r in valid_readings if cutoff_baseline_start <= r["timestamp"].timestamp() <= cutoff_7d]

    # If baseline before 7d doesn't have enough readings, fall back to 30d window
    if len(readings_baseline) < 2:
        readings_baseline = [r for r in valid_readings if r["timestamp"].timestamp() >= cutoff_30d]

    if len(readings_baseline) >= 2 and len(readings_7d) >= 2:
        runtime_baseline_delta = max(0.0, readings_baseline[-1]["runtimeHours"] - readings_baseline[0]["runtimeHours"])
        runtime_7d_delta = max(0.0, readings_7d[-1]["runtimeHours"] - readings_7d[0]["runtimeHours"])

        days_baseline = max(1.0, (readings_baseline[-1]["timestamp"].timestamp() - readings_baseline[0]["timestamp"].timestamp()) / 86400)
        days_7 = max(1.0, (readings_7d[-1]["timestamp"].timestamp() - readings_7d[0]["timestamp"].timestamp()) / 86400)

        daily_avg_baseline = runtime_baseline_delta / days_baseline
        daily_avg_7 = runtime_7d_delta / days_7

        if daily_avg_baseline > 0:
            deviation_ratio = (daily_avg_7 - daily_avg_baseline) / daily_avg_baseline
            pct_deviation = round(deviation_ratio * 100, 1)

            if deviation_ratio > 0.50:
                reasons.append("runtime_deviation_severe")
                rule_statuses.append("Critical")
                rule_explanations.append(f"7-day runtime is {pct_deviation}% above the 30-day daily average (>50% threshold)")
            elif deviation_ratio > 0.25:
                reasons.append("runtime_deviation")
                rule_statuses.append("Watch")
                rule_explanations.append(f"7-day runtime is {pct_deviation}% above the 30-day daily average (>25% threshold)")

    # ==========================================
    # RULE 2 — Recent error code
    # ==========================================
    # If any reading in the last 48 hours has a non-null errorCode -> Critical ('recent_error')
    # ==========================================
    cutoff_48h = now.timestamp() - (48 * 3600)
    recent_readings_48h = [r for r in valid_readings if r["timestamp"].timestamp() >= cutoff_48h]

    recent_errors = [r for r in recent_readings_48h if r["errorCode"]]
    if recent_errors:
        latest_error = recent_errors[-1]
        err_code = latest_error["errorCode"]
        reasons.append("recent_error")
        rule_statuses.append("Critical")
        rule_explanations.append(f"error code '{err_code}' logged within the past 48 hours")

    # ==========================================
    # RULE 3 — Maintenance overdue
    # ==========================================
    # If today - lastServicedDate > maintenanceIntervalDays -> Watch ('maintenance_overdue')
    # If today - lastServicedDate > 1.5 * maintenanceIntervalDays -> Critical ('maintenance_severely_overdue')
    # ==========================================
    service_baseline = last_serviced_date or installed_date
    if service_baseline and maintenance_interval_days:
        days_since_service = (now.timestamp() - service_baseline.timestamp()) / 86400
        days_overdue = round(days_since_service - maintenance_interval_days, 1)

        if days_since_service > (1.5 * maintenance_interval_days):
            reasons.append("maintenance_severely_overdue")
            rule_statuses.append("Critical")
            rule_explanations.append(
                f"routine maintenance is severely overdue ({round(days_since_service)} days since service vs {maintenance_interval_days} day interval, >150%)"
            )
        elif days_since_service > maintenance_interval_days:
            reasons.append("maintenance_overdue")
            rule_statuses.append("Watch")
            rule_explanations.append(
                f"routine maintenance is overdue by {days_overdue} days ({round(days_since_service)} days since service vs {maintenance_interval_days} day interval)"
            )

    # ==========================================
    # RULE 4 — Temperature threshold
    # ==========================================
    # If a reading's temperature exceeds the asset-type default max threshold -> Critical ('temperature_exceeded')
    # ==========================================
    # We check recent readings (last 48h) or latest reading for temperature violations
    readings_to_check_temp = recent_readings_48h if recent_readings_48h else (valid_readings[-1:] if valid_readings else [])
    temp_exceeded_readings = [
        r for r in readings_to_check_temp
        if r["temperature"] is not None and r["temperature"] > max_safe_temp
    ]

    if temp_exceeded_readings:
        highest_temp = max(r["temperature"] for r in temp_exceeded_readings)
        reasons.append("temperature_exceeded")
        rule_statuses.append("Critical")
        rule_explanations.append(
            f"operating temperature reached {highest_temp}°C, exceeding the safe limit of {max_safe_temp}°C for {asset_type}"
        )

    # ==========================================
    # STATUS RESOLUTION: Highest severity among triggered rules
    # ==========================================
    status = max(rule_statuses, key=lambda s: SEVERITY_RANKS[s])

    # ==========================================
    # SUMMARY GENERATION: Explainable, plain-language synthesis
    # ==========================================
    if status == "Healthy":
        summary = f"{asset_name} is operating normally within baseline operational parameters. No maintenance action required."
    else:
        reasons_combined = "; ".join(rule_explanations)
        action_verb = "Immediate inspection and intervention required" if status == "Critical" else "Recommend scheduling maintenance inspection"
        summary = f"{asset_name} flagged as {status}: {reasons_combined}. {action_verb}."

    return {
        "status": status,
        "reasons": reasons,
        "summary": summary,
        "rule_explanations": rule_explanations,
    }
