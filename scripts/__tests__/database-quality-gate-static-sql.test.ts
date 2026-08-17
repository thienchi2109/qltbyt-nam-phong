import { describe, expect, it } from "vitest"

import { loadDatabaseQualityGateModule } from "./database-quality-gate-test-support"

type StaticSqlModule = {
  hasFailClosedJwtGuards: (content: string) => boolean
  hasRawLikePattern: (content: string) => boolean
}

describe("database quality gate static SQL lexical rules", () => {
  it("blocks variable-first raw LIKE patterns and ignores nested-comment decoys", async () => {
    const source = await loadDatabaseQualityGateModule<StaticSqlModule>("static-sql")

    expect(
      source.hasRawLikePattern(
        "SELECT * FROM public.items WHERE name ILIKE p_search || '%' || p_suffix;"
      )
    ).toBe(true)
    expect(
      source.hasRawLikePattern(
        "/* outer comment /* name ILIKE p_search || '%' */ still comment */ SELECT 1;"
      )
    ).toBe(false)
  })

  it("requires an empty-role rejection in addition to a NULL guard", async () => {
    const source = await loadDatabaseQualityGateModule<StaticSqlModule>("static-sql")
    const unsafe = [
      "v_role := NULLIF(current_setting('request.jwt.claims', true)::json->>'app_role', '');",
      "v_user_id := NULLIF(current_setting('request.jwt.claims', true)::json->>'user_id', '');",
      "IF v_role IS NULL THEN RAISE EXCEPTION 'missing' USING errcode = '42501'; END IF;",
      "IF v_user_id IS NULL THEN RAISE EXCEPTION 'missing' USING errcode = '42501'; END IF;",
    ].join("\n")
    const safe = unsafe.replace("v_role IS NULL THEN", "v_role IS NULL OR v_role = '' THEN")

    expect(source.hasFailClosedJwtGuards(unsafe)).toBe(false)
    expect(source.hasFailClosedJwtGuards(safe)).toBe(true)
  })

  it("accepts sanitizer-derived variables but rejects mixed raw operands", async () => {
    const source = await loadDatabaseQualityGateModule<StaticSqlModule>("static-sql")

    expect(
      source.hasRawLikePattern(
        [
          "v_sanitized_search := public._sanitize_ilike_pattern(p_search);",
          "SELECT * FROM public.items WHERE name ILIKE '%' || v_sanitized_search || '%';",
        ].join("\n")
      )
    ).toBe(false)
    expect(
      source.hasRawLikePattern(
        "SELECT * FROM public.items WHERE name ILIKE '%' || _sanitize_ilike_pattern(p_safe) || p_unsafe || '%';"
      )
    ).toBe(true)
    expect(
      source.hasRawLikePattern(
        [
          "v_pattern := _sanitize_ilike_pattern(p_safe) || p_untrusted;",
          "SELECT * FROM public.items WHERE name ILIKE '%' || v_pattern || '%';",
        ].join("\n")
      )
    ).toBe(true)
  })

  it("requires guards to precede business SQL in the function body", async () => {
    const source = await loadDatabaseQualityGateModule<StaticSqlModule>("static-sql")
    const guardedPrologue = [
      "v_role := NULLIF(current_setting('request.jwt.claims', true)::json->>'app_role', '');",
      "v_user_id := NULLIF(current_setting('request.jwt.claims', true)::json->>'user_id', '');",
      "IF v_role IS NULL OR v_role = '' THEN RAISE EXCEPTION 'missing' USING errcode = '42501'; END IF;",
      "IF v_user_id IS NULL THEN RAISE EXCEPTION 'missing' USING errcode = '42501'; END IF;",
    ].join("\n")

    expect(
      source.hasFailClosedJwtGuards(`DELETE FROM public.sensitive_rows;\n${guardedPrologue}`)
    ).toBe(false)
    expect(
      source.hasFailClosedJwtGuards(`PERFORM public.touch_sensitive_rows();\n${guardedPrologue}`)
    ).toBe(false)
    expect(source.hasFailClosedJwtGuards(guardedPrologue)).toBe(true)
  })

  it("rejects coercive, ineffective, and reassigned JWT guard flows", async () => {
    const source = await loadDatabaseQualityGateModule<StaticSqlModule>("static-sql")
    const guardedPrologue = [
      "v_role := NULLIF(current_setting('request.jwt.claims', true)::json->>'app_role', '');",
      "v_user_id := NULLIF(current_setting('request.jwt.claims', true)::json->>'user_id', '');",
      "IF v_role IS NULL OR v_role = '' THEN RAISE EXCEPTION 'missing' USING errcode = '42501'; END IF;",
      "IF v_user_id IS NULL THEN RAISE EXCEPTION 'missing' USING errcode = '42501'; END IF;",
    ].join("\n")

    expect(
      source.hasFailClosedJwtGuards(
        guardedPrologue.replace(
          "NULLIF(current_setting('request.jwt.claims', true)::json->>'app_role', '')",
          "COALESCE(current_setting('request.jwt.claims', true)::json->>'app_role', 'global')"
        )
      )
    ).toBe(false)
    expect(
      source.hasFailClosedJwtGuards(
        guardedPrologue.replace(
          "IF v_role IS NULL OR v_role = '' THEN",
          "IF (v_role IS NULL OR v_role = '') AND FALSE THEN"
        )
      )
    ).toBe(false)
    expect(
      source.hasFailClosedJwtGuards(
        `${guardedPrologue}\nv_role := 'global';\nSELECT * FROM public.sensitive_rows;`
      )
    ).toBe(false)
  })

  it("rejects reassigned sanitizer variables and composite sanitizer operands", async () => {
    const source = await loadDatabaseQualityGateModule<StaticSqlModule>("static-sql")

    expect(
      source.hasRawLikePattern(
        [
          "v_sanitized_search := _sanitize_ilike_pattern(p_search);",
          "v_sanitized_search := p_untrusted;",
          "SELECT * FROM public.items WHERE name ILIKE '%' || v_sanitized_search || '%';",
        ].join("\n")
      )
    ).toBe(true)
    expect(
      source.hasRawLikePattern(
        "SELECT * FROM public.items WHERE name ILIKE concat('%', _sanitize_ilike_pattern(p_safe), p_untrusted, '%');"
      )
    ).toBe(true)
  })

  it("does not carry sanitizer provenance between function bodies", async () => {
    const source = await loadDatabaseQualityGateModule<StaticSqlModule>("static-sql")
    const twoFunctions = [
      "CREATE FUNCTION public.first_fn() RETURNS void LANGUAGE plpgsql AS $$",
      "BEGIN",
      "  v_pattern := _sanitize_ilike_pattern(p_search);",
      "END;",
      "$$;",
      "CREATE FUNCTION public.second_fn() RETURNS void LANGUAGE plpgsql AS $$",
      "BEGIN",
      "  PERFORM 1 FROM public.items WHERE name ILIKE '%' || v_pattern || '%';",
      "END;",
      "$$;",
    ].join("\n")

    expect(source.hasRawLikePattern(twoFunctions)).toBe(true)
  })

  it("rejects permission exceptions that an inner handler swallows", async () => {
    const source = await loadDatabaseQualityGateModule<StaticSqlModule>("static-sql")
    const swallowedGuard = [
      "v_role := NULLIF(current_setting('request.jwt.claims', true)::json->>'app_role', '');",
      "v_user_id := NULLIF(current_setting('request.jwt.claims', true)::json->>'user_id', '');",
      "IF v_role IS NULL OR v_role = '' THEN",
      "  BEGIN",
      "    RAISE EXCEPTION 'missing' USING errcode = '42501';",
      "  EXCEPTION WHEN OTHERS THEN NULL;",
      "  END;",
      "END IF;",
      "IF v_user_id IS NULL THEN RAISE EXCEPTION 'missing' USING errcode = '42501'; END IF;",
      "SELECT * FROM public.sensitive_rows;",
    ].join("\n")

    expect(source.hasFailClosedJwtGuards(swallowedGuard)).toBe(false)
  })
})
