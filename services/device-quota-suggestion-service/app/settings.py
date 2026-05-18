import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    internal_token: str = ""
    provider_name: str = "vm-local"
    provider_version: str = "0.1.0"
    model_name: str = "dangvantuan/vietnamese-embedding"
    cache_dir: str = "/data/cache"


def load_settings() -> Settings:
    internal_token = os.environ.get("DQSS_INTERNAL_TOKEN", "")
    if not internal_token:
        raise ValueError("DQSS_INTERNAL_TOKEN must be configured")
    return Settings(
        internal_token=internal_token,
        provider_name=os.environ.get("DQSS_PROVIDER_NAME", "vm-local"),
        provider_version=os.environ.get("DQSS_PROVIDER_VERSION", "0.1.0"),
        model_name=os.environ.get(
            "DQSS_MODEL_NAME",
            "dangvantuan/vietnamese-embedding",
        ),
        cache_dir=os.environ.get("DQSS_CACHE_DIR", "/data/cache"),
    )
