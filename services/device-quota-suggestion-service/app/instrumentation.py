import json
import logging
import time
from typing import Dict

from app.normalization import normalize_text
from app.schemas import ResponseDict, SuggestRequest

LOGGER = logging.getLogger("dqss.suggest")


def elapsed_ms(started: float) -> float:
    return round((time.perf_counter() - started) * 1000, 3)


def request_metrics(request: SuggestRequest) -> Dict[str, int]:
    normalized_names = {normalize_text(item.name) for item in request.deviceNames}
    return {
        "deviceNameCount": len(request.deviceNames),
        "uniqueDeviceNameCount": len(normalized_names),
        "deviceCount": sum(len(item.deviceIds) for item in request.deviceNames),
        "categoryCount": len(request.categories),
    }


def log_success(result: ResponseDict, request: SuggestRequest) -> None:
    LOGGER.info(
        json.dumps(
            {
                "event": "dqss.suggest.completed",
                "requestId": result["requestId"],
                "facilityId": request.facilityId,
                "provider": result["provider"],
                "timings": result["timings"],
                "metrics": _public_metrics(result["metrics"]),
                "cache": result["cache"],
            },
            sort_keys=True,
            separators=(",", ":"),
        )
    )


def log_failure(
    request: SuggestRequest,
    provider: dict,
    timings: dict,
    error: BaseException,
) -> None:
    LOGGER.info(
        json.dumps(
            {
                "event": "dqss.suggest.failed",
                "requestId": request.requestId,
                "facilityId": request.facilityId,
                "provider": provider,
                "timings": timings,
                "metrics": request_metrics(request),
                "failureReason": type(error).__name__,
            },
            sort_keys=True,
            separators=(",", ":"),
        )
    )


def _public_metrics(metrics: dict) -> dict:
    return {
        "deviceNameCount": metrics["deviceNameCount"],
        "uniqueDeviceNameCount": metrics["uniqueDeviceNameCount"],
        "deviceCount": metrics["deviceCount"],
        "categoryCount": metrics["categoryCount"],
    }
