"""Cloud Function (2nd gen, HTTP-triggered by Cloud Scheduler): sums this
month's Cloud Run CPU/memory usage for whoop-backend and republishes the
worse of the two as a percent-of-free-tier custom metric. A Cloud Monitoring
alerting policy watches that metric and emails a warning at 75%/90% — no
hand-rolled email-sending code needed here, Monitoring's own notification
channels handle delivery.

Free tier figures are Cloud Run's published request-based-billing free tier
(cloud.google.com/run/pricing, us-central1 pricing): 180,000 vCPU-seconds
and 360,000 GiB-seconds per month. These reset with the calendar month, so
usage is summed from the 1st of the current month (UTC) to now.
"""
from __future__ import annotations

import os
from datetime import datetime, timezone

import functions_framework
from google.cloud import monitoring_v3

PROJECT_ID = os.environ["PROJECT_ID"]
SERVICE_NAME = os.environ.get("SERVICE_NAME", "whoop-backend")

CPU_FREE_TIER_VCPU_SECONDS = 180_000
MEMORY_FREE_TIER_GIB_SECONDS = 360_000

CUSTOM_METRIC_TYPE = "custom.googleapis.com/cloud_run/free_tier_usage_percent"


def _month_to_date_sum(client: monitoring_v3.MetricServiceClient, metric_type: str) -> float:
    """Sums a DELTA metric's value across the current calendar month so far,
    across all revisions/instances of the service (cross_series_reducer
    collapses them into one total)."""
    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    results = client.list_time_series(
        request={
            "name": f"projects/{PROJECT_ID}",
            "filter": (
                f'metric.type="{metric_type}" AND '
                f'resource.type="cloud_run_revision" AND '
                f'resource.label.service_name="{SERVICE_NAME}"'
            ),
            "interval": {"end_time": now, "start_time": month_start},
            "aggregation": {
                "alignment_period": {"seconds": 3600},
                "per_series_aligner": monitoring_v3.Aggregation.Aligner.ALIGN_SUM,
                "cross_series_reducer": monitoring_v3.Aggregation.Reducer.REDUCE_SUM,
            },
        }
    )
    return sum(point.value.double_value for series in results for point in series.points)


def _publish_percent(client: monitoring_v3.MetricServiceClient, percent: float) -> None:
    series = monitoring_v3.TimeSeries()
    series.metric.type = CUSTOM_METRIC_TYPE
    series.resource.type = "global"
    series.resource.labels["project_id"] = PROJECT_ID
    series.points = [
        {
            "interval": {"end_time": datetime.now(timezone.utc)},
            "value": {"double_value": percent},
        }
    ]
    client.create_time_series(name=f"projects/{PROJECT_ID}", time_series=[series])


@functions_framework.http
def check_free_tier_usage(request):
    client = monitoring_v3.MetricServiceClient()

    cpu_seconds = _month_to_date_sum(client, "run.googleapis.com/container/cpu/allocation_time")
    memory_gib_seconds = _month_to_date_sum(client, "run.googleapis.com/container/memory/allocation_time")

    cpu_pct = cpu_seconds / CPU_FREE_TIER_VCPU_SECONDS * 100
    memory_pct = memory_gib_seconds / MEMORY_FREE_TIER_GIB_SECONDS * 100
    worst_pct = max(cpu_pct, memory_pct)

    _publish_percent(client, worst_pct)

    return {
        "cpu_vcpu_seconds": round(cpu_seconds, 1),
        "cpu_percent_of_free_tier": round(cpu_pct, 1),
        "memory_gib_seconds": round(memory_gib_seconds, 1),
        "memory_percent_of_free_tier": round(memory_pct, 1),
        "worst_percent": round(worst_pct, 1),
    }
