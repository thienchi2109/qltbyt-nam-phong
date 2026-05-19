from pathlib import Path


def test_readme_documents_large_payload_smoke_and_no_canary_scope():
    readme = Path("README.md").read_text(encoding="utf-8")

    assert "unit-17" in readme
    assert "504 unique" in readme
    assert "1940 devices" in readme
    assert "2000 unique" in readme
    assert "phase timings" in readme
    assert "total duration" in readme
    assert "Do not re-enable production canary" in readme
