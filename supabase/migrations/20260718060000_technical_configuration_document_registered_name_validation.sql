BEGIN;

CREATE OR REPLACE FUNCTION public._technical_configuration_validate_document_url(p_url TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_authority TEXT;
  v_host_port TEXT;
  v_host TEXT;
  v_port TEXT;
  v_decoded_host TEXT;
  v_host_bytes BYTEA;
  v_character TEXT;
  v_index INTEGER;
BEGIN
  IF p_url IS NULL
     OR p_url !~* '^https?:\/\/'
     OR p_url ~ '[[:space:]]'
     OR p_url ~ '[[:cntrl:]]'
     OR position(E'\\' IN p_url) > 0 THEN
    RAISE EXCEPTION 'validation_error' USING ERRCODE = 'PT422';
  END IF;

  v_authority := substring(p_url FROM '^[Hh][Tt][Tt][Pp][Ss]?://([^/?#]+)');
  IF v_authority IS NULL THEN
    RAISE EXCEPTION 'validation_error' USING ERRCODE = 'PT422';
  END IF;

  v_host_port := regexp_replace(v_authority, '^.*@', '');
  IF v_host_port = '' THEN
    RAISE EXCEPTION 'validation_error' USING ERRCODE = 'PT422';
  END IF;

  IF left(v_host_port, 1) = '[' THEN
    IF v_host_port !~ '^\[[0-9A-Fa-f:.]+\](?::[0-9]*)?$' THEN
      RAISE EXCEPTION 'validation_error' USING ERRCODE = 'PT422';
    END IF;

    v_host := substring(v_host_port FROM '^\[([0-9A-Fa-f:.]+)\]');
    IF v_host IS NULL OR position(':' IN v_host) = 0 THEN
      RAISE EXCEPTION 'validation_error' USING ERRCODE = 'PT422';
    END IF;

    BEGIN
      PERFORM v_host::INET;
    EXCEPTION
      WHEN invalid_text_representation THEN
        RAISE EXCEPTION 'validation_error' USING ERRCODE = 'PT422';
    END;

    v_port := substring(v_host_port FROM '\]:([0-9]*)$');
  ELSE
    IF v_host_port ~ ':' THEN
      IF v_host_port !~ '^[^:]+:[0-9]*$' THEN
        RAISE EXCEPTION 'validation_error' USING ERRCODE = 'PT422';
      END IF;
      v_host := split_part(v_host_port, ':', 1);
      v_port := split_part(v_host_port, ':', 2);
    ELSE
      v_host := v_host_port;
      v_port := NULL;
    END IF;

    IF v_host = ''
       OR position('[' IN v_host) > 0
       OR position(']' IN v_host) > 0 THEN
      RAISE EXCEPTION 'validation_error' USING ERRCODE = 'PT422';
    END IF;

    v_host_bytes := ''::BYTEA;
    v_index := 1;
    WHILE v_index <= char_length(v_host) LOOP
      v_character := substring(v_host FROM v_index FOR 1);
      IF v_character = '%' THEN
        IF substring(v_host FROM v_index FOR 3) !~ '^%[0-9A-Fa-f]{2}$' THEN
          RAISE EXCEPTION 'validation_error' USING ERRCODE = 'PT422';
        END IF;
        v_host_bytes :=
          v_host_bytes || decode(substring(v_host FROM v_index + 1 FOR 2), 'hex');
        v_index := v_index + 3;
      ELSE
        v_host_bytes := v_host_bytes || convert_to(v_character, 'UTF8');
        v_index := v_index + 1;
      END IF;
    END LOOP;

    BEGIN
      v_decoded_host := convert_from(v_host_bytes, 'UTF8');
    EXCEPTION
      WHEN character_not_in_repertoire THEN
        RAISE EXCEPTION 'validation_error' USING ERRCODE = 'PT422';
    END;

    IF v_decoded_host = ''
       OR v_decoded_host ~ '[[:space:][:cntrl:]/?#@:<>^|%]'
       OR position('[' IN v_decoded_host) > 0
       OR position(']' IN v_decoded_host) > 0
       OR position(E'\\' IN v_decoded_host) > 0 THEN
      RAISE EXCEPTION 'validation_error' USING ERRCODE = 'PT422';
    END IF;

    IF v_decoded_host ~ '^[0-9.]+$' THEN
      BEGIN
        PERFORM v_decoded_host::INET;
      EXCEPTION
        WHEN invalid_text_representation THEN
          RAISE EXCEPTION 'validation_error' USING ERRCODE = 'PT422';
      END;
    END IF;
  END IF;

  IF v_port IS NOT NULL AND v_port <> '' THEN
    IF length(v_port) > 5 THEN
      RAISE EXCEPTION 'validation_error' USING ERRCODE = 'PT422';
    ELSIF v_port::INTEGER > 65535 THEN
      RAISE EXCEPTION 'validation_error' USING ERRCODE = 'PT422';
    END IF;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public._technical_configuration_validate_document_url(TEXT)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public._technical_configuration_validate_document_url(TEXT)
  TO service_role;

COMMIT;
