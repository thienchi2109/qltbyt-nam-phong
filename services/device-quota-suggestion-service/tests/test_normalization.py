from app.normalization import normalize_text


def test_normalize_text_removes_vietnamese_diacritics_case_and_punctuation():
    assert normalize_text("  Máy   XÉT-nghiệm, PCR!! ") == "may xet nghiem pcr"


def test_normalize_text_preserves_vietnamese_d_as_ascii_d():
    assert normalize_text("Bơm tiêm điện") == "bom tiem dien"


def test_normalize_text_collapses_empty_or_symbol_only_values():
    assert normalize_text(" -- ") == ""
