from pathlib import Path


FORBIDDEN_STRINGS = [
    "embed-device-name",
    "hybrid_search_category_batch",
    "SUPABASE_SERVICE_ROLE_KEY",
    "create_client(",
]


def test_service_source_does_not_include_supabase_embedding_or_search_calls():
    app_dir = Path(__file__).resolve().parents[1] / "app"
    source = "\n".join(
        path.read_text(encoding="utf-8")
        for path in app_dir.rglob("*.py")
        if path.is_file()
    )

    for forbidden in FORBIDDEN_STRINGS:
        assert forbidden not in source
