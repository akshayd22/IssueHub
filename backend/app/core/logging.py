import json
import logging
import os
import sys
import uuid
from datetime import datetime


class RequestIdFilter(logging.Filter):
    def __init__(self, request_id_provider):
        super().__init__()
        self._provider = request_id_provider

    def filter(self, record: logging.LogRecord) -> bool:
        record.request_id = self._provider() or "-"
        return True


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload = {
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "level": record.levelname,
            "message": record.getMessage(),
            "logger": record.name,
            "request_id": getattr(record, "request_id", "-"),
        }
        if record.exc_info:
            payload["exc_info"] = self.formatException(record.exc_info)
        return json.dumps(payload)


def setup_logging(log_dir: str, log_level: str, request_id_provider) -> None:
    os.makedirs(log_dir, exist_ok=True)

    root = logging.getLogger()
    root.setLevel(log_level.upper())

    formatter = JsonFormatter()
    request_filter = RequestIdFilter(request_id_provider)

    stream_handler = logging.StreamHandler(sys.stdout)
    stream_handler.setFormatter(formatter)
    stream_handler.addFilter(request_filter)

    file_handler = logging.FileHandler(os.path.join(log_dir, "app.log"))
    file_handler.setFormatter(formatter)
    file_handler.addFilter(request_filter)

    root.handlers = [stream_handler, file_handler]


def new_request_id() -> str:
    return str(uuid.uuid4())
