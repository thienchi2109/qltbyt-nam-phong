-- Phase 1: additive, immutable regulatory catalog foundation for
-- Thong tu 10/2026. No active quota/category/equipment data is touched.

BEGIN;

CREATE SCHEMA device_quota_internal;

REVOKE ALL ON SCHEMA device_quota_internal FROM PUBLIC, anon, authenticated;

CREATE TABLE public.device_quota_regulatory_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_number TEXT NOT NULL UNIQUE CHECK (btrim(document_number) <> ''),
  document_title TEXT NOT NULL CHECK (btrim(document_title) <> ''),
  appendix_title TEXT NOT NULL CHECK (btrim(appendix_title) <> ''),
  document_version TEXT NOT NULL CHECK (btrim(document_version) <> ''),
  issued_date DATE NOT NULL,
  effective_date DATE NOT NULL CHECK (effective_date >= issued_date),
  source_pdf_path TEXT NOT NULL CHECK (btrim(source_pdf_path) <> ''),
  source_pdf_sha256 TEXT NOT NULL CHECK (source_pdf_sha256 ~ '^[0-9a-f]{64}$'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.device_quota_regulatory_catalog_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.device_quota_regulatory_documents(id),
  artifact_id TEXT NOT NULL UNIQUE CHECK (btrim(artifact_id) <> ''),
  appendix_json_path TEXT NOT NULL CHECK (btrim(appendix_json_path) <> ''),
  appendix_json_sha256 TEXT NOT NULL CHECK (appendix_json_sha256 ~ '^[0-9a-f]{64}$'),
  appendix_markdown_path TEXT NOT NULL CHECK (btrim(appendix_markdown_path) <> ''),
  appendix_markdown_sha256 TEXT NOT NULL CHECK (appendix_markdown_sha256 ~ '^[0-9a-f]{64}$'),
  extraction_revision TEXT NOT NULL CHECK (btrim(extraction_revision) <> ''),
  import_status TEXT NOT NULL CHECK (import_status IN ('loading', 'ready', 'rejected')),
  is_canonical BOOLEAN NOT NULL DEFAULT false,
  source_pages TEXT NOT NULL CHECK (btrim(source_pages) <> ''),
  source_note TEXT NOT NULL CHECK (btrim(source_note) <> ''),
  expected_structural_rows INTEGER NOT NULL CHECK (expected_structural_rows > 0),
  expected_section_rows INTEGER NOT NULL CHECK (expected_section_rows >= 0),
  expected_item_rows INTEGER NOT NULL CHECK (expected_item_rows >= 0),
  expected_child_item_rows INTEGER NOT NULL CHECK (expected_child_item_rows >= 0),
  expected_top_level_item_rows INTEGER NOT NULL CHECK (expected_top_level_item_rows >= 0),
  expected_rule_lines INTEGER NOT NULL CHECK (expected_rule_lines >= 0),
  expected_footnotes INTEGER NOT NULL CHECK (expected_footnotes >= 0),
  expected_items_with_source_pages INTEGER NOT NULL CHECK (expected_items_with_source_pages >= 0),
  expected_items_with_source_references INTEGER NOT NULL CHECK (expected_items_with_source_references >= 0),
  expected_multiline_items INTEGER NOT NULL CHECK (expected_multiline_items >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (document_id, extraction_revision),
  CHECK (NOT is_canonical OR import_status = 'ready')
);

CREATE UNIQUE INDEX device_quota_regulatory_one_canonical_ready_idx
  ON public.device_quota_regulatory_catalog_versions (document_id)
  WHERE is_canonical AND import_status = 'ready';

CREATE TABLE public.device_quota_regulatory_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  catalog_version_id UUID NOT NULL REFERENCES public.device_quota_regulatory_catalog_versions(id),
  source_identifier TEXT NOT NULL,
  source_label TEXT NOT NULL,
  name TEXT NOT NULL CHECK (btrim(name) <> ''),
  source_order INTEGER NOT NULL CHECK (source_order > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (catalog_version_id, source_identifier),
  UNIQUE (catalog_version_id, source_order)
);

CREATE TABLE public.device_quota_regulatory_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  catalog_version_id UUID NOT NULL REFERENCES public.device_quota_regulatory_catalog_versions(id),
  section_id UUID REFERENCES public.device_quota_regulatory_sections(id),
  source_identifier TEXT NOT NULL,
  source_label TEXT NOT NULL,
  name TEXT NOT NULL CHECK (btrim(name) <> ''),
  original_unit TEXT NOT NULL CHECK (btrim(original_unit) <> ''),
  quota_lines TEXT[] NOT NULL DEFAULT '{}',
  source_order INTEGER NOT NULL CHECK (source_order > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (catalog_version_id, source_identifier),
  UNIQUE (catalog_version_id, source_order)
);

CREATE TABLE public.device_quota_regulatory_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES public.device_quota_regulatory_items(id),
  line_order INTEGER NOT NULL CHECK (line_order > 0),
  source_text TEXT NOT NULL CHECK (btrim(source_text) <> ''),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (item_id, line_order)
);

CREATE TABLE public.device_quota_regulatory_source_positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  catalog_version_id UUID NOT NULL REFERENCES public.device_quota_regulatory_catalog_versions(id),
  source_identifier TEXT NOT NULL,
  source_label TEXT NOT NULL,
  row_type TEXT NOT NULL CHECK (row_type IN ('section', 'item')),
  source_level INTEGER NOT NULL CHECK (source_level IN (0, 1)),
  parent_source_identifier TEXT,
  source_order INTEGER NOT NULL CHECK (source_order > 0),
  section_id UUID REFERENCES public.device_quota_regulatory_sections(id),
  item_id UUID REFERENCES public.device_quota_regulatory_items(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (catalog_version_id, source_identifier),
  UNIQUE (catalog_version_id, source_order),
  CHECK (
    (row_type = 'section' AND source_level = 0 AND section_id IS NOT NULL AND item_id IS NULL)
    OR (row_type = 'item' AND source_level = 0 AND section_id IS NULL AND item_id IS NOT NULL)
    OR (row_type = 'item' AND source_level = 1 AND section_id IS NOT NULL AND item_id IS NOT NULL)
  ),
  CHECK (
    (source_level = 0 AND parent_source_identifier IS NULL)
    OR (source_level = 1 AND parent_source_identifier IS NOT NULL)
  ),
  FOREIGN KEY (catalog_version_id, parent_source_identifier)
    REFERENCES public.device_quota_regulatory_source_positions (
      catalog_version_id,
      source_identifier
    )
);

CREATE TABLE public.device_quota_regulatory_source_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_position_id UUID NOT NULL REFERENCES public.device_quota_regulatory_source_positions(id),
  page_number INTEGER NOT NULL CHECK (page_number > 0),
  page_order INTEGER NOT NULL CHECK (page_order > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (source_position_id, page_number),
  UNIQUE (source_position_id, page_order)
);

CREATE TABLE public.device_quota_regulatory_references (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  catalog_version_id UUID NOT NULL REFERENCES public.device_quota_regulatory_catalog_versions(id),
  source_position_id UUID REFERENCES public.device_quota_regulatory_source_positions(id),
  reference_type TEXT NOT NULL CHECK (reference_type IN ('source', 'footnote')),
  reference_order INTEGER NOT NULL CHECK (reference_order > 0),
  reference_text TEXT NOT NULL CHECK (btrim(reference_text) <> ''),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (catalog_version_id, reference_type, reference_order),
  CHECK (
    (reference_type = 'source' AND source_position_id IS NOT NULL)
    OR (reference_type = 'footnote' AND source_position_id IS NULL)
  )
);

CREATE OR REPLACE FUNCTION device_quota_internal.catalog_is_complete(
  p_catalog_version_id UUID
)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.device_quota_regulatory_catalog_versions AS v
    WHERE v.id = p_catalog_version_id
      AND (SELECT count(*) FROM public.device_quota_regulatory_source_positions p
           WHERE p.catalog_version_id = v.id) = v.expected_structural_rows
      AND (SELECT count(*) FROM public.device_quota_regulatory_sections s
           WHERE s.catalog_version_id = v.id) = v.expected_section_rows
      AND (SELECT count(*) FROM public.device_quota_regulatory_items i
           WHERE i.catalog_version_id = v.id) = v.expected_item_rows
      AND (SELECT count(*) FROM public.device_quota_regulatory_items i
           WHERE i.catalog_version_id = v.id AND i.section_id IS NOT NULL) = v.expected_child_item_rows
      AND (SELECT count(*) FROM public.device_quota_regulatory_items i
           WHERE i.catalog_version_id = v.id AND i.section_id IS NULL) = v.expected_top_level_item_rows
      AND (SELECT count(*) FROM public.device_quota_regulatory_rules r
           JOIN public.device_quota_regulatory_items i ON i.id = r.item_id
           WHERE i.catalog_version_id = v.id) = v.expected_rule_lines
      AND (SELECT count(*) FROM public.device_quota_regulatory_references r
           WHERE r.catalog_version_id = v.id AND r.reference_type = 'footnote') = v.expected_footnotes
      AND (SELECT count(DISTINCT p.item_id)
           FROM public.device_quota_regulatory_source_positions p
           WHERE p.catalog_version_id = v.id AND p.item_id IS NOT NULL) = v.expected_item_rows
      AND (SELECT count(DISTINCT p.item_id)
           FROM public.device_quota_regulatory_source_pages sp
           JOIN public.device_quota_regulatory_source_positions p ON p.id = sp.source_position_id
           WHERE p.catalog_version_id = v.id AND p.item_id IS NOT NULL) = v.expected_items_with_source_pages
      AND (SELECT count(*)
           FROM public.device_quota_regulatory_references r
           JOIN public.device_quota_regulatory_source_positions p ON p.id = r.source_position_id
           WHERE r.catalog_version_id = v.id AND r.reference_type = 'source'
             AND p.item_id IS NOT NULL) = v.expected_items_with_source_references
      AND (SELECT count(*)
           FROM public.device_quota_regulatory_items i
           WHERE i.catalog_version_id = v.id AND cardinality(i.quota_lines) > 1) = v.expected_multiline_items
      AND (SELECT count(*)
           FROM public.device_quota_regulatory_source_positions p
           WHERE p.catalog_version_id = v.id
             AND NOT EXISTS (
               SELECT 1 FROM public.device_quota_regulatory_source_pages sp
               WHERE sp.source_position_id = p.id
             )) = 0
      AND (SELECT count(*)
           FROM public.device_quota_regulatory_source_positions p
           WHERE p.catalog_version_id = v.id
             AND NOT EXISTS (
               SELECT 1 FROM public.device_quota_regulatory_references r
               WHERE r.source_position_id = p.id AND r.reference_type = 'source'
             )) = 0
  );
$$;

CREATE OR REPLACE FUNCTION public.device_quota_regulatory_ready_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.import_status = 'ready'
     AND NOT device_quota_internal.catalog_is_complete(NEW.id)
  THEN
    RAISE EXCEPTION 'Regulatory catalog snapshot is incomplete'
      USING errcode = '23514';
  END IF;

  IF TG_OP = 'UPDATE' AND (OLD.import_status = 'ready' OR OLD.is_canonical) THEN
    RAISE EXCEPTION 'Regulatory catalog versions are immutable'
      USING errcode = '55000';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Regulatory catalog versions are immutable'
      USING errcode = '55000';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.device_quota_regulatory_immutable_row()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION 'Regulatory catalog rows are immutable'
      USING errcode = '55000';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER device_quota_regulatory_catalog_versions_guard
  BEFORE INSERT OR UPDATE OR DELETE
  ON public.device_quota_regulatory_catalog_versions
  FOR EACH ROW EXECUTE FUNCTION public.device_quota_regulatory_ready_transition();

CREATE TRIGGER device_quota_regulatory_documents_immutable
  BEFORE UPDATE OR DELETE
  ON public.device_quota_regulatory_documents
  FOR EACH ROW EXECUTE FUNCTION public.device_quota_regulatory_immutable_row();

CREATE TRIGGER device_quota_regulatory_sections_immutable
  BEFORE UPDATE OR DELETE
  ON public.device_quota_regulatory_sections
  FOR EACH ROW EXECUTE FUNCTION public.device_quota_regulatory_immutable_row();

CREATE TRIGGER device_quota_regulatory_items_immutable
  BEFORE UPDATE OR DELETE
  ON public.device_quota_regulatory_items
  FOR EACH ROW EXECUTE FUNCTION public.device_quota_regulatory_immutable_row();

CREATE TRIGGER device_quota_regulatory_rules_immutable
  BEFORE UPDATE OR DELETE
  ON public.device_quota_regulatory_rules
  FOR EACH ROW EXECUTE FUNCTION public.device_quota_regulatory_immutable_row();

CREATE TRIGGER device_quota_regulatory_positions_immutable
  BEFORE UPDATE OR DELETE
  ON public.device_quota_regulatory_source_positions
  FOR EACH ROW EXECUTE FUNCTION public.device_quota_regulatory_immutable_row();

CREATE TRIGGER device_quota_regulatory_pages_immutable
  BEFORE UPDATE OR DELETE
  ON public.device_quota_regulatory_source_pages
  FOR EACH ROW EXECUTE FUNCTION public.device_quota_regulatory_immutable_row();

CREATE TRIGGER device_quota_regulatory_references_immutable
  BEFORE UPDATE OR DELETE
  ON public.device_quota_regulatory_references
  FOR EACH ROW EXECUTE FUNCTION public.device_quota_regulatory_immutable_row();

ALTER TABLE public.device_quota_regulatory_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_quota_regulatory_catalog_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_quota_regulatory_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_quota_regulatory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_quota_regulatory_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_quota_regulatory_source_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_quota_regulatory_source_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_quota_regulatory_references ENABLE ROW LEVEL SECURITY;

CREATE POLICY device_quota_regulatory_documents_no_client_access
  ON public.device_quota_regulatory_documents FOR ALL TO public USING (false) WITH CHECK (false);
CREATE POLICY device_quota_regulatory_catalog_versions_no_client_access
  ON public.device_quota_regulatory_catalog_versions FOR ALL TO public USING (false) WITH CHECK (false);
CREATE POLICY device_quota_regulatory_sections_no_client_access
  ON public.device_quota_regulatory_sections FOR ALL TO public USING (false) WITH CHECK (false);
CREATE POLICY device_quota_regulatory_items_no_client_access
  ON public.device_quota_regulatory_items FOR ALL TO public USING (false) WITH CHECK (false);
CREATE POLICY device_quota_regulatory_rules_no_client_access
  ON public.device_quota_regulatory_rules FOR ALL TO public USING (false) WITH CHECK (false);
CREATE POLICY device_quota_regulatory_positions_no_client_access
  ON public.device_quota_regulatory_source_positions FOR ALL TO public USING (false) WITH CHECK (false);
CREATE POLICY device_quota_regulatory_pages_no_client_access
  ON public.device_quota_regulatory_source_pages FOR ALL TO public USING (false) WITH CHECK (false);
CREATE POLICY device_quota_regulatory_references_no_client_access
  ON public.device_quota_regulatory_references FOR ALL TO public USING (false) WITH CHECK (false);

REVOKE ALL ON TABLE public.device_quota_regulatory_documents FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.device_quota_regulatory_catalog_versions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.device_quota_regulatory_sections FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.device_quota_regulatory_items FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.device_quota_regulatory_rules FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.device_quota_regulatory_source_positions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.device_quota_regulatory_source_pages FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.device_quota_regulatory_references FROM PUBLIC, anon, authenticated;

-- PHASE_0_MANIFEST_JSON_BEGIN
/*
{"document_number":"10/2026/TT-BYT","issued_date":"2026-05-14","effective_date":"2026-07-01","import_status":"ready","extraction_revision":"phase-0-2026-08-31-r1","source_artifact":{"pdf":{"sha256":"04186bd3cc50cf541f5e481d25480741412cfe3c899040c35713d4eeda24fd8f"},"appendix_json":{"sha256":"01aac96335d83fd51ca45e9bce0b03c20ec3a333822151f320ac22948cc9b438"},"appendix_markdown":{"sha256":"1ac4b38c14675b2de065c13c09036b89c92de87c17da840776e351f67761c4ca"}},"completeness":{"structural_rows":42,"section_rows":5,"equipment_item_rows":37,"source_declared_child_rows":16,"top_level_item_rows":21,"footnotes":3,"items_with_source_pages":37,"items_with_source_references":37,"multiline_quota_items":32}}
*/
-- PHASE_0_MANIFEST_JSON_END

-- PHASE_0_APPENDIX_JSON_BEGIN
/*
{"source_file":"757_Thong-tu-10-2026-TT-BYT_88e68354fb.pdf","document_title":"Phụ lục - Tiêu chuẩn, định mức sử dụng máy móc, thiết bị chuyên dùng trong lĩnh vực y tế","columns":["TT","Chủng loại","Đơn vị tính","Số lượng định mức"],"rows":[{"id":"1","tt":"1","type":"section","level":0,"parent":null,"name":"Máy X - quang","unit":null,"quota":null,"source_pages":[6,7],"source_ref":"Phụ lục, trang 6, 7"},{"id":"1a","tt":"a","type":"item","level":1,"parent":"1","name":"Máy X - quang kỹ thuật số chụp tổng quát","unit":"Máy","quota":["Nhu cầu trung bình dưới 300 ca chụp/tháng/cơ sở: 01 Máy/cơ sở.","Nhu cầu trung bình từ 300 đến 2.600 ca chụp/tháng/cơ sở: tối đa 02 Máy/cơ sở.","Nhu cầu trung bình trên 2.600 ca chụp/tháng/cơ sở: tăng thêm 1.300 ca chụp/tháng/cơ sở được bổ sung thêm 01 Máy.","Trường hợp cơ sở có các đơn vị điều trị cách ly hoặc khu truyền nhiễm độc lập: được bổ sung 01 Máy/đơn vị."],"source_pages":[6],"source_ref":"Phụ lục, trang 6"},{"id":"1b","tt":"b","type":"item","level":1,"parent":"1","name":"Máy X - quang di động","unit":"Máy","quota":["Dưới 200 giường nội trú/cơ sở: 01 Máy/cơ sở.","Ngoài ra:","Tăng thêm 200 giường nội trú/cơ sở: được bổ sung thêm 01 Máy.","Trường hợp cơ sở có đơn vị thực hiện chức năng hồi sức tích cực; cấp cứu; hồi sức sau phẫu thuật; giám định pháp y; pháp y tâm thần: được bổ sung thêm 01 Máy/đơn vị."],"source_pages":[6],"source_ref":"Phụ lục, trang 6"},{"id":"1c","tt":"c","type":"item","level":1,"parent":"1","name":"Máy X - quang C Arm","unit":"Máy","quota":["Định mức 01 Máy/02 phòng mổ.","Trường hợp đơn vị thực hiện kỹ thuật chụp mật tụy ngược dòng (ERCP), tán sỏi ngoài cơ thể hoặc can thiệp: được bổ sung thêm 01 Máy/đơn vị."],"source_pages":[6],"source_ref":"Phụ lục, trang 6"},{"id":"1d","tt":"d","type":"item","level":1,"parent":"1","name":"Máy X - quang răng toàn cảnh","unit":"Máy","quota":["Nhu cầu trung bình dưới 600 ca chụp/tháng/cơ sở: Tối đa 02 Máy/cơ sở.","Nhu cầu trung bình trên 600 ca chụp/tháng/cơ sở: tăng thêm 600 ca chụp/tháng/cơ sở được bổ sung thêm 01 Máy."],"source_pages":[6],"source_ref":"Phụ lục, trang 6"},{"id":"1dd","tt":"đ","type":"item","level":1,"parent":"1","name":"Máy X - quang đo mật độ xương toàn thân","unit":"Máy","quota":["Nhu cầu trung bình dưới 200 ca chụp/tháng/cơ sở: 01 Máy/cơ sở.","Nhu cầu trung bình từ 200 đến 1.000 ca chụp/tháng/cơ sở: Tối đa 02 Máy/cơ sở.","Nhu cầu trung bình trên 1.000 ca chụp/tháng/cơ sở: tăng thêm 500 ca chụp/tháng/cơ sở được bổ sung thêm 01 Máy."],"source_pages":[6,7],"source_ref":"Phụ lục, trang 6, 7"},{"id":"2","tt":"2","type":"section","level":0,"parent":null,"name":"Hệ thống CT - Scanner","unit":null,"quota":null,"source_pages":[7],"source_ref":"Phụ lục, trang 7"},{"id":"2a","tt":"a","type":"item","level":1,"parent":"2","name":"Hệ thống CT Scanner < 64 dãy đầu thu","unit":"Hệ thống","quota":["Nhu cầu trung bình dưới 300 ca chụp/tháng/cơ sở: 01 Hệ thống/cơ sở.","Nhu cầu trung bình từ 300 đến 1.300 ca chụp/tháng/cơ sở: Tối đa 02 Hệ thống/cơ sở.","Nhu cầu trung bình trên 1.300 ca chụp/tháng/cơ sở: tăng thêm 650 ca chụp/tháng/cơ sở được bổ sung thêm 01 Hệ thống."],"source_pages":[7],"source_ref":"Phụ lục, trang 7"},{"id":"2b","tt":"b","type":"item","level":1,"parent":"2","name":"Hệ thống CT Scanner 64 - 128 dãy đầu thu","unit":"Hệ thống","quota":["Nhu cầu trung bình dưới 400 ca chụp/tháng/cơ sở: 01 Hệ thống/cơ sở.","Nhu cầu trung bình trên 400 ca chụp/tháng/cơ sở: tăng thêm 400 ca chụp/tháng/cơ sở được bổ sung thêm 01 Hệ thống."],"source_pages":[7],"source_ref":"Phụ lục, trang 7"},{"id":"2c","tt":"c","type":"item","level":1,"parent":"2","name":"Hệ thống CT Scanner > 128 dãy đầu thu","unit":"Hệ thống","quota":["Nhu cầu trung bình dưới 400 ca chụp/tháng/cơ sở: 01 Hệ thống/cơ sở.","Nhu cầu trung bình trên 400 ca chụp/tháng/cơ sở: tăng thêm 400 ca chụp/tháng/cơ sở được bổ sung thêm 01 Hệ thống."],"source_pages":[7],"source_ref":"Phụ lục, trang 7"},{"id":"3","tt":"3","type":"item","level":0,"parent":null,"name":"Hệ thống chụp cộng hưởng từ ≥ 1.5 Tesla","unit":"Hệ thống","quota":["Nhu cầu trung bình dưới 400 ca chụp/tháng/cơ sở: 01 Hệ thống/cơ sở.","Nhu cầu trung bình trên 400 ca chụp/tháng/cơ sở: tăng thêm 400 ca chụp/tháng/cơ sở được bổ sung thêm 01 Hệ thống."],"source_pages":[7],"source_ref":"Phụ lục, trang 7"},{"id":"4","tt":"4","type":"item","level":0,"parent":null,"name":"Hệ thống chụp mạch số hóa xóa nền (DSA)","unit":"Hệ thống","quota":["Nhu cầu trung bình dưới 100 ca chụp/tháng/cơ sở: 01 Hệ thống/cơ sở.","Nhu cầu trung bình từ 100 đến 200 ca chụp/tháng/cơ sở: tối đa 02 Hệ thống/cơ sở.","Nhu cầu trung bình trên 200 ca chụp/tháng/cơ sở: tăng thêm 200 ca chụp/tháng/cơ sở được bổ sung thêm 01 Hệ thống."],"source_pages":[7],"source_ref":"Phụ lục, trang 7"},{"id":"5","tt":"5","type":"section","level":0,"parent":null,"name":"Máy siêu âm","unit":null,"quota":null,"source_pages":[7,8],"source_ref":"Phụ lục, trang 7, 8"},{"id":"5a","tt":"a","type":"item","level":1,"parent":"5","name":"Máy siêu âm chuyên tim mạch","unit":"Máy","quota":["Nhu cầu trung bình dưới 300 ca chụp/tháng/cơ sở: 01 Máy/cơ sở.","Nhu cầu trung bình trên 300 ca chụp/tháng/cơ sở: tăng thêm 300 ca chụp/tháng/cơ sở được bổ sung thêm 01 Máy.","Ngoài ra:","Trường hợp cơ sở có đơn vị chụp mạch số hóa xóa nền (DSA); đơn vị thực hiện chức năng hồi sức; đơn vị thực hiện chức năng cấp cứu: được bổ sung thêm 01 Máy.","Phòng mổ: được bổ sung thêm 01 Máy/phòng mổ tim."],"source_pages":[8],"source_ref":"Phụ lục, trang 8"},{"id":"5b","tt":"b","type":"item","level":1,"parent":"5","name":"Máy siêu âm tổng quát","unit":"Máy","quota":["Nhu cầu trung bình dưới 600 ca chụp/tháng/cơ sở: 01 Máy/cơ sở.","Nhu cầu trung bình từ 600 đến 1.600 ca chụp/tháng/cơ sở: tối đa 02 Máy/cơ sở.","Nhu cầu trung bình trên 1.600 ca chụp/tháng/cơ sở: tăng thêm 800 ca chụp/tháng/cơ sở được bổ sung thêm 01 Máy.","Ngoài ra:","Trường hợp cơ sở có đơn vị hồi sức; cấp cứu; hồi sức sau phẫu thuật, can thiệp và các đơn vị có sử dụng kỹ thuật siêu âm hỗ trợ, chọc hút noãn, chuyển phôi: được bổ sung thêm 01 Máy/đơn vị."],"source_pages":[8],"source_ref":"Phụ lục, trang 8"},{"id":"6","tt":"6","type":"item","level":0,"parent":null,"name":"Máy xét nghiệm sinh hóa các loại","unit":"Tổng công suất các máy (Test/giờ)¹","quota":["Nhu cầu trung bình dưới 1.200 test/ngày/cơ sở: tổng công suất các Máy tối đa 1.200 test/giờ/cơ sở.","Nhu cầu trung bình trên 1.200 test/ngày/cơ sở: tăng thêm 1.200 test/ngày/cơ sở được bổ sung thêm tổng công suất các Máy tối đa 1.200 test/giờ/cơ sở."],"source_pages":[8],"source_ref":"Phụ lục, trang 8"},{"id":"7","tt":"7","type":"item","level":0,"parent":null,"name":"Máy xét nghiệm miễn dịch các loại","unit":"Tổng công suất các máy (Test/giờ)","quota":["Nhu cầu trung bình dưới 200 test/ngày/cơ sở: tổng công suất các Máy tối đa 200 test/giờ/cơ sở.","Nhu cầu trung bình trên 200 test/ngày/cơ sở: tăng thêm 200 test/ngày/cơ sở được bổ sung thêm tổng công suất các Máy tối đa 200 test/giờ/cơ sở."],"source_pages":[8],"source_ref":"Phụ lục, trang 8"},{"id":"8","tt":"8","type":"item","level":0,"parent":null,"name":"Máy xét nghiệm huyết học","unit":"Tổng công suất các máy (Test/giờ)","quota":["Nhu cầu trung bình dưới 300 test/ngày/cơ sở: tổng công suất các Máy tối đa 100 test/giờ/cơ sở.","Nhu cầu trung bình trên 300 test/ngày/cơ sở: tăng thêm 300 test/ngày/cơ sở được bổ sung thêm tổng công suất các Máy tối đa 100 test/giờ/cơ sở."],"source_pages":[9],"source_ref":"Phụ lục, trang 9"},{"id":"9","tt":"9","type":"item","level":0,"parent":null,"name":"Máy thận nhân tạo (HD)","unit":"Máy","quota":["Đáp ứng công suất sử dụng trung bình 02 ca/ngày: 01 Máy.","Ngoài ra:","Trung bình 05 Máy được bổ sung thêm 01 Máy.","Trường hợp cơ sở có đơn vị hồi sức: trung bình 05 giường hồi sức được bổ sung thêm 01 Máy."],"source_pages":[9],"source_ref":"Phụ lục, trang 9"},{"id":"10","tt":"10","type":"item","level":0,"parent":null,"name":"Máy thở xâm nhập","unit":"Máy","quota":["Định mức 01 Máy/giường hồi sức sau phẫu thuật; hồi sức tích cực; cấp cứu; sơ sinh.","Ngoài ra: Trung bình 06 Máy được bổ sung thêm 01 Máy."],"source_pages":[9],"source_ref":"Phụ lục, trang 9"},{"id":"11","tt":"11","type":"item","level":0,"parent":null,"name":"Máy thở xâm nhập di động","unit":"Máy","quota":["Định mức cho phòng mổ: 01 Máy/02 phòng mổ.","Ngoài ra: Định mức 01 Máy/05 giường hồi sức sau phẫu thuật; hồi sức tích cực; cấp cứu; sơ sinh."],"source_pages":[9],"source_ref":"Phụ lục, trang 9"},{"id":"12","tt":"12","type":"item","level":0,"parent":null,"name":"Máy gây mê","unit":"Máy","quota":["Định mức 01 Máy/bàn mổ.","Ngoài ra:","Trung bình 06 Máy được bổ sung thêm 01 Máy.","Trường hợp cơ sở có đơn vị sử dụng kỹ thuật gây mê hỗ trợ được bổ sung thêm 01 Máy/đơn vị."],"source_pages":[9],"source_ref":"Phụ lục, trang 9"},{"id":"13","tt":"13","type":"item","level":0,"parent":null,"name":"Máy theo dõi bệnh nhân ≥ 5 thông số","unit":"Máy","quota":["Định mức 01 Máy/05 giường nội trú.","Ngoài ra:","Được bổ sung thêm 01 Máy/bàn mổ.","Trường hợp cơ sở có giường hồi sức sau phẫu thuật; hồi sức tích cực; cấp cứu; thận nhân tạo: được bổ sung thêm 01 Máy/giường.","Trường hợp cơ sở có phòng thực hiện kỹ thuật can thiệp: được bổ sung thêm 01 Máy/phòng.","Trường hợp cơ sở có đơn vị thuộc lĩnh vực pháp y tâm thần: căn cứ nhu cầu thực tế để quyết định định mức sử dụng dựa trên giường bệnh hoặc đơn vị hồi sức cấp cứu để xác định theo nguyên tắc đảm bảo tiết kiệm, hiệu quả."],"source_pages":[9],"source_ref":"Phụ lục, trang 9"},{"id":"14","tt":"14","type":"item","level":0,"parent":null,"name":"Bơm tiêm điện","unit":"Cái","quota":["Định mức 01 Cái/05 giường nội trú.","Ngoài ra:","Được bổ sung thêm 05 Cái/bàn mổ.","Trường hợp cơ sở có giường hồi sức sau phẫu thuật: được bổ sung thêm tối đa 05 Cái/giường.","Trường hợp cơ sở có giường hồi sức tích cực; cấp cứu: được bổ sung thêm tối đa 10 Cái/giường.","Trường hợp cơ sở có giường điều trị bệnh nhân ngoại trú chuyên khoa nhi; ung bướu; huyết học: được bổ sung thêm tối đa 02 Cái/giường."],"source_pages":[10],"source_ref":"Phụ lục, trang 10"},{"id":"15","tt":"15","type":"item","level":0,"parent":null,"name":"Máy truyền dịch","unit":"Máy","quota":["Định mức 01 Máy/05 giường nội trú.","Ngoài ra:","Được bổ sung thêm 05 Máy/bàn mổ.","Trường hợp cơ sở có giường hồi sức sau phẫu thuật: được bổ sung thêm tối đa 05 Máy/giường","Trường hợp cơ sở có giường hồi sức tích cực; cấp cứu: được bổ sung thêm tối đa 05 Máy/giường.","Trường hợp cơ sở có giường điều trị bệnh nhân ngoại trú chuyên khoa nhi; ung bướu; huyết học: được bổ sung thêm tối đa 02 Máy/giường."],"source_pages":[10],"source_ref":"Phụ lục, trang 10"},{"id":"16","tt":"16","type":"section","level":0,"parent":null,"name":"Dao mổ","unit":null,"quota":null,"source_pages":[10],"source_ref":"Phụ lục, trang 10"},{"id":"16a","tt":"a","type":"item","level":1,"parent":"16","name":"Dao mổ điện cao tần","unit":"Cái","quota":["Định mức 01 Cái/01 bàn mổ.","Ngoài ra:","Được bổ sung thêm 01 Cái/01 phòng thủ thuật.","Trung bình 05 Cái được bổ sung thêm 01 Cái."],"source_pages":[10],"source_ref":"Phụ lục, trang 10"},{"id":"16b","tt":"b","type":"item","level":1,"parent":"16","name":"Dao mổ siêu âm/ Dao hàn mạch/ Dao hàn mô","unit":"Cái","quota":["Định mức: 01 Cái/phòng mổ.","Ngoài ra: Trung bình 05 Cái được bổ sung thêm 01 Cái."],"source_pages":[10],"source_ref":"Phụ lục, trang 10"},{"id":"17","tt":"17","type":"item","level":0,"parent":null,"name":"Máy phá rung tim","unit":"Máy","quota":["Định mức 01 Máy/Phòng mổ.","Ngoài ra:","Được bổ sung thêm: 01 Máy/10 giường hồi sức, cấp cứu; chống độc.","Được bổ sung thêm: 01 Máy/đơn vị tim mạch.","Được bổ sung thêm: 01 Máy/phòng DSA.","Được bổ sung thêm: 01 Máy/đơn vị nội trú khác.","Được bổ sung thêm: 01 Máy/đơn vị khám ngoại trú; đơn vị điều trị trong ngày."],"source_pages":[10],"source_ref":"Phụ lục, trang 10"},{"id":"18","tt":"18","type":"item","level":0,"parent":null,"name":"Hệ thống phẫu thuật nội soi","unit":"Hệ thống","quota":["Định mức 01 Hệ thống/bàn mổ có mổ nội soi.","Ngoài ra: Trung bình 05 Hệ thống được bổ sung thêm 01 Hệ thống."],"source_pages":[11],"source_ref":"Phụ lục, trang 11"},{"id":"19","tt":"19","type":"item","level":0,"parent":null,"name":"Đèn mổ treo trần","unit":"Cái","quota":["Định mức 01 Cái/bàn mổ."],"source_pages":[11],"source_ref":"Phụ lục, trang 11"},{"id":"20","tt":"20","type":"item","level":0,"parent":null,"name":"Đèn mổ di động","unit":"Cái","quota":["Định mức tối đa 01 Cái/phòng tiểu phẫu; khoa hồi sức; khoa cấp cứu."],"source_pages":[11],"source_ref":"Phụ lục, trang 11"},{"id":"21","tt":"21","type":"item","level":0,"parent":null,"name":"Bàn mổ","unit":"Cái","quota":["Định mức 01 Cái/phòng mổ."],"source_pages":[11],"source_ref":"Phụ lục, trang 11"},{"id":"22","tt":"22","type":"item","level":0,"parent":null,"name":"Máy điện tim","unit":"Máy","quota":["Định mức 01 Máy/50 bệnh nhân khám ngoại trú/ngày.","Trường hợp cơ sở có đơn vị điều trị nội trú; cấp cứu; hồi sức tích cực; pháp y tâm thần: được bổ sung thêm 01 Máy/đơn vị."],"source_pages":[11],"source_ref":"Phụ lục, trang 11"},{"id":"23","tt":"23","type":"section","level":0,"parent":null,"name":"Hệ thống nội soi chẩn đoán","unit":null,"quota":null,"source_pages":[11,12],"source_ref":"Phụ lục, trang 11, 12"},{"id":"23a","tt":"a","type":"item","level":1,"parent":"23","name":"Hệ thống nội soi tiêu hóa (dạ dày, đại tràng)","unit":"Hệ thống","quota":["Nhu cầu trung bình dưới 100 ca/tháng/cơ sở: 01 Hệ thống/cơ sở.","Nhu cầu trung bình từ 100 đến 400 ca/tháng/cơ sở: tối đa 02 Hệ thống/cơ sở.","Nhu cầu trung bình trên 400 ca/tháng/cơ sở: Được bổ sung thêm 01 Hệ thống cho mỗi 200 ca tăng thêm/tháng/cơ sở.","Trường hợp cơ sở có đơn vị hồi sức; cấp cứu: được bổ sung thêm 01 Hệ thống/đơn vị."],"source_pages":[11],"source_ref":"Phụ lục, trang 11"},{"id":"23b","tt":"b","type":"item","level":1,"parent":"23","name":"Hệ thống nội soi khí quản, phế quản","unit":"Hệ thống","quota":["Nhu cầu trung bình dưới 100 ca/tháng/cơ sở: 01 Hệ thống/cơ sở.","Nhu cầu trung bình từ 100 đến 400 ca/tháng/cơ sở: tối đa 02 Hệ thống/cơ sở.","Nhu cầu trung bình trên 400 ca/tháng/cơ sở: Được bổ sung thêm 01 Hệ thống cho mỗi 200 ca tăng thêm/tháng/cơ sở.","Trường hợp cơ sở có đơn vị hồi sức; cấp cứu: Được bổ sung thêm 01 Hệ thống/đơn vị."],"source_pages":[11],"source_ref":"Phụ lục, trang 11"},{"id":"23c","tt":"c","type":"item","level":1,"parent":"23","name":"Hệ thống nội soi tai mũi họng","unit":"Hệ thống","quota":["Nhu cầu trung bình dưới 200 ca/tháng/cơ sở: 01 Hệ thống/cơ sở.","Nhu cầu trung bình từ 200 đến 1.800 ca/tháng/cơ sở tối đa 02 Hệ thống/cơ sở.","Nhu cầu trung bình trên 1.800 ca/tháng/cơ sở: Được bổ sung thêm 01 Hệ thống cho mỗi 900 ca tăng thêm/tháng/cơ sở.","Trường hợp cơ sở có bàn khám Tai mũi họng: được bổ sung thêm 01 Hệ thống/ bàn khám Tai mũi họng."],"source_pages":[12],"source_ref":"Phụ lục, trang 12"},{"id":"23d","tt":"d","type":"item","level":1,"parent":"23","name":"Hệ thống nội soi tiết niệu","unit":"Hệ thống","quota":["Nhu cầu trung bình dưới 100 ca/tháng/cơ sở: 01 Hệ thống/cơ sở.","Nhu cầu trung bình từ 100 đến 600 ca/ tháng/cơ sở: tối đa 02 Hệ thống /cơ sở.","Nhu cầu trung bình trên 600 ca/tháng/cơ sở: Được bổ sung thêm 01 Hệ thống cho mỗi 300 ca tăng thêm/tháng/cơ sở.","Trường hợp cơ sở có sử dụng máy tán sỏi: được bổ sung thêm 01 Hệ thống/máy tán sỏi."],"source_pages":[12],"source_ref":"Phụ lục, trang 12"},{"id":"24","tt":"24","type":"item","level":0,"parent":null,"name":"Máy soi cổ tử cung","unit":"Máy","quota":["Định mức 01 Máy/ 01 bàn khám phụ khoa."],"source_pages":[12],"source_ref":"Phụ lục, trang 12"},{"id":"25","tt":"25","type":"item","level":0,"parent":null,"name":"Máy theo dõi sản khoa 02 chức năng","unit":"Máy","quota":["Định mức 01 Máy/ 01 bàn đẻ.","Trường hợp cơ sở có giường nội trú theo dõi sản khoa: được bổ sung thêm 01 Máy/10 giường nội trú theo dõi sản khoa."],"source_pages":[12],"source_ref":"Phụ lục, trang 12"},{"id":"26","tt":"26","type":"item","level":0,"parent":null,"name":"Máy và ghế nha khoa","unit":"Bộ","quota":["Định mức 01 Bộ/01 vị trí khám, điều trị nha khoa."],"source_pages":[12],"source_ref":"Phụ lục, trang 12"}],"footnotes":["¹ Tiêu chuẩn, định mức không phụ thuộc số lượng máy xét nghiệm. Áp dụng tương tự đối với các Máy xét nghiệm khác.","* Đơn vị quy định tại Phụ lục này là bộ phận hoạt động chuyên môn thực hiện một hoặc một số lĩnh vực chuyên môn y tế thuộc cơ cấu tổ chức của đơn vị sự nghiệp công lập trong lĩnh vực y tế.","** Định mức sử dụng được xác định theo nguyên tắc làm tròn số lên. Áp dụng nguyên tắc làm tròn số lên cho tất cả thiết bị y tế khi tính định mức."],"notes":"Cấu trúc được tái tạo từ bảng ở trang 6-12. Nội dung quota được giữ theo văn bản, chỉ chuẩn hóa ngắt dòng do layout PDF. Các section row (1, 2, 5, 16, 23) được giữ riêng để React có thể render colspan."}
-- PHASE_0_APPENDIX_JSON_END
*/

DO $seed$
DECLARE
  v_document_id UUID;
  v_version_id UUID;
  v_section_id UUID;
  v_item_id UUID;
  v_position_id UUID;
  v_row JSONB;
  v_page INTEGER;
  v_line TEXT;
  v_ordinality INTEGER;
  v_source_order INTEGER := 0;
  v_appendix JSONB := $appendix${"source_file":"757_Thong-tu-10-2026-TT-BYT_88e68354fb.pdf","document_title":"Phụ lục - Tiêu chuẩn, định mức sử dụng máy móc, thiết bị chuyên dùng trong lĩnh vực y tế","columns":["TT","Chủng loại","Đơn vị tính","Số lượng định mức"],"rows":[{"id":"1","tt":"1","type":"section","level":0,"parent":null,"name":"Máy X - quang","unit":null,"quota":null,"source_pages":[6,7],"source_ref":"Phụ lục, trang 6, 7"},{"id":"1a","tt":"a","type":"item","level":1,"parent":"1","name":"Máy X - quang kỹ thuật số chụp tổng quát","unit":"Máy","quota":["Nhu cầu trung bình dưới 300 ca chụp/tháng/cơ sở: 01 Máy/cơ sở.","Nhu cầu trung bình từ 300 đến 2.600 ca chụp/tháng/cơ sở: tối đa 02 Máy/cơ sở.","Nhu cầu trung bình trên 2.600 ca chụp/tháng/cơ sở: tăng thêm 1.300 ca chụp/tháng/cơ sở được bổ sung thêm 01 Máy.","Trường hợp cơ sở có các đơn vị điều trị cách ly hoặc khu truyền nhiễm độc lập: được bổ sung 01 Máy/đơn vị."],"source_pages":[6],"source_ref":"Phụ lục, trang 6"},{"id":"1b","tt":"b","type":"item","level":1,"parent":"1","name":"Máy X - quang di động","unit":"Máy","quota":["Dưới 200 giường nội trú/cơ sở: 01 Máy/cơ sở.","Ngoài ra:","Tăng thêm 200 giường nội trú/cơ sở: được bổ sung thêm 01 Máy.","Trường hợp cơ sở có đơn vị thực hiện chức năng hồi sức tích cực; cấp cứu; hồi sức sau phẫu thuật; giám định pháp y; pháp y tâm thần: được bổ sung thêm 01 Máy/đơn vị."],"source_pages":[6],"source_ref":"Phụ lục, trang 6"},{"id":"1c","tt":"c","type":"item","level":1,"parent":"1","name":"Máy X - quang C Arm","unit":"Máy","quota":["Định mức 01 Máy/02 phòng mổ.","Trường hợp đơn vị thực hiện kỹ thuật chụp mật tụy ngược dòng (ERCP), tán sỏi ngoài cơ thể hoặc can thiệp: được bổ sung thêm 01 Máy/đơn vị."],"source_pages":[6],"source_ref":"Phụ lục, trang 6"},{"id":"1d","tt":"d","type":"item","level":1,"parent":"1","name":"Máy X - quang răng toàn cảnh","unit":"Máy","quota":["Nhu cầu trung bình dưới 600 ca chụp/tháng/cơ sở: Tối đa 02 Máy/cơ sở.","Nhu cầu trung bình trên 600 ca chụp/tháng/cơ sở: tăng thêm 600 ca chụp/tháng/cơ sở được bổ sung thêm 01 Máy."],"source_pages":[6],"source_ref":"Phụ lục, trang 6"},{"id":"1dd","tt":"đ","type":"item","level":1,"parent":"1","name":"Máy X - quang đo mật độ xương toàn thân","unit":"Máy","quota":["Nhu cầu trung bình dưới 200 ca chụp/tháng/cơ sở: 01 Máy/cơ sở.","Nhu cầu trung bình từ 200 đến 1.000 ca chụp/tháng/cơ sở: Tối đa 02 Máy/cơ sở.","Nhu cầu trung bình trên 1.000 ca chụp/tháng/cơ sở: tăng thêm 500 ca chụp/tháng/cơ sở được bổ sung thêm 01 Máy."],"source_pages":[6,7],"source_ref":"Phụ lục, trang 6, 7"},{"id":"2","tt":"2","type":"section","level":0,"parent":null,"name":"Hệ thống CT - Scanner","unit":null,"quota":null,"source_pages":[7],"source_ref":"Phụ lục, trang 7"},{"id":"2a","tt":"a","type":"item","level":1,"parent":"2","name":"Hệ thống CT Scanner < 64 dãy đầu thu","unit":"Hệ thống","quota":["Nhu cầu trung bình dưới 300 ca chụp/tháng/cơ sở: 01 Hệ thống/cơ sở.","Nhu cầu trung bình từ 300 đến 1.300 ca chụp/tháng/cơ sở: Tối đa 02 Hệ thống/cơ sở.","Nhu cầu trung bình trên 1.300 ca chụp/tháng/cơ sở: tăng thêm 650 ca chụp/tháng/cơ sở được bổ sung thêm 01 Hệ thống."],"source_pages":[7],"source_ref":"Phụ lục, trang 7"},{"id":"2b","tt":"b","type":"item","level":1,"parent":"2","name":"Hệ thống CT Scanner 64 - 128 dãy đầu thu","unit":"Hệ thống","quota":["Nhu cầu trung bình dưới 400 ca chụp/tháng/cơ sở: 01 Hệ thống/cơ sở.","Nhu cầu trung bình trên 400 ca chụp/tháng/cơ sở: tăng thêm 400 ca chụp/tháng/cơ sở được bổ sung thêm 01 Hệ thống."],"source_pages":[7],"source_ref":"Phụ lục, trang 7"},{"id":"2c","tt":"c","type":"item","level":1,"parent":"2","name":"Hệ thống CT Scanner > 128 dãy đầu thu","unit":"Hệ thống","quota":["Nhu cầu trung bình dưới 400 ca chụp/tháng/cơ sở: 01 Hệ thống/cơ sở.","Nhu cầu trung bình trên 400 ca chụp/tháng/cơ sở: tăng thêm 400 ca chụp/tháng/cơ sở được bổ sung thêm 01 Hệ thống."],"source_pages":[7],"source_ref":"Phụ lục, trang 7"},{"id":"3","tt":"3","type":"item","level":0,"parent":null,"name":"Hệ thống chụp cộng hưởng từ ≥ 1.5 Tesla","unit":"Hệ thống","quota":["Nhu cầu trung bình dưới 400 ca chụp/tháng/cơ sở: 01 Hệ thống/cơ sở.","Nhu cầu trung bình trên 400 ca chụp/tháng/cơ sở: tăng thêm 400 ca chụp/tháng/cơ sở được bổ sung thêm 01 Hệ thống."],"source_pages":[7],"source_ref":"Phụ lục, trang 7"},{"id":"4","tt":"4","type":"item","level":0,"parent":null,"name":"Hệ thống chụp mạch số hóa xóa nền (DSA)","unit":"Hệ thống","quota":["Nhu cầu trung bình dưới 100 ca chụp/tháng/cơ sở: 01 Hệ thống/cơ sở.","Nhu cầu trung bình từ 100 đến 200 ca chụp/tháng/cơ sở: tối đa 02 Hệ thống/cơ sở.","Nhu cầu trung bình trên 200 ca chụp/tháng/cơ sở: tăng thêm 200 ca chụp/tháng/cơ sở được bổ sung thêm 01 Hệ thống."],"source_pages":[7],"source_ref":"Phụ lục, trang 7"},{"id":"5","tt":"5","type":"section","level":0,"parent":null,"name":"Máy siêu âm","unit":null,"quota":null,"source_pages":[7,8],"source_ref":"Phụ lục, trang 7, 8"},{"id":"5a","tt":"a","type":"item","level":1,"parent":"5","name":"Máy siêu âm chuyên tim mạch","unit":"Máy","quota":["Nhu cầu trung bình dưới 300 ca chụp/tháng/cơ sở: 01 Máy/cơ sở.","Nhu cầu trung bình trên 300 ca chụp/tháng/cơ sở: tăng thêm 300 ca chụp/tháng/cơ sở được bổ sung thêm 01 Máy.","Ngoài ra:","Trường hợp cơ sở có đơn vị chụp mạch số hóa xóa nền (DSA); đơn vị thực hiện chức năng hồi sức; đơn vị thực hiện chức năng cấp cứu: được bổ sung thêm 01 Máy.","Phòng mổ: được bổ sung thêm 01 Máy/phòng mổ tim."],"source_pages":[8],"source_ref":"Phụ lục, trang 8"},{"id":"5b","tt":"b","type":"item","level":1,"parent":"5","name":"Máy siêu âm tổng quát","unit":"Máy","quota":["Nhu cầu trung bình dưới 600 ca chụp/tháng/cơ sở: 01 Máy/cơ sở.","Nhu cầu trung bình từ 600 đến 1.600 ca chụp/tháng/cơ sở: tối đa 02 Máy/cơ sở.","Nhu cầu trung bình trên 1.600 ca chụp/tháng/cơ sở: tăng thêm 800 ca chụp/tháng/cơ sở được bổ sung thêm 01 Máy.","Ngoài ra:","Trường hợp cơ sở có đơn vị hồi sức; cấp cứu; hồi sức sau phẫu thuật, can thiệp và các đơn vị có sử dụng kỹ thuật siêu âm hỗ trợ, chọc hút noãn, chuyển phôi: được bổ sung thêm 01 Máy/đơn vị."],"source_pages":[8],"source_ref":"Phụ lục, trang 8"},{"id":"6","tt":"6","type":"item","level":0,"parent":null,"name":"Máy xét nghiệm sinh hóa các loại","unit":"Tổng công suất các máy (Test/giờ)¹","quota":["Nhu cầu trung bình dưới 1.200 test/ngày/cơ sở: tổng công suất các Máy tối đa 1.200 test/giờ/cơ sở.","Nhu cầu trung bình trên 1.200 test/ngày/cơ sở: tăng thêm 1.200 test/ngày/cơ sở được bổ sung thêm tổng công suất các Máy tối đa 1.200 test/giờ/cơ sở."],"source_pages":[8],"source_ref":"Phụ lục, trang 8"},{"id":"7","tt":"7","type":"item","level":0,"parent":null,"name":"Máy xét nghiệm miễn dịch các loại","unit":"Tổng công suất các máy (Test/giờ)","quota":["Nhu cầu trung bình dưới 200 test/ngày/cơ sở: tổng công suất các Máy tối đa 200 test/giờ/cơ sở.","Nhu cầu trung bình trên 200 test/ngày/cơ sở: tăng thêm 200 test/ngày/cơ sở được bổ sung thêm tổng công suất các Máy tối đa 200 test/giờ/cơ sở."],"source_pages":[8],"source_ref":"Phụ lục, trang 8"},{"id":"8","tt":"8","type":"item","level":0,"parent":null,"name":"Máy xét nghiệm huyết học","unit":"Tổng công suất các máy (Test/giờ)","quota":["Nhu cầu trung bình dưới 300 test/ngày/cơ sở: tổng công suất các Máy tối đa 100 test/giờ/cơ sở.","Nhu cầu trung bình trên 300 test/ngày/cơ sở: tăng thêm 300 test/ngày/cơ sở được bổ sung thêm tổng công suất các Máy tối đa 100 test/giờ/cơ sở."],"source_pages":[9],"source_ref":"Phụ lục, trang 9"},{"id":"9","tt":"9","type":"item","level":0,"parent":null,"name":"Máy thận nhân tạo (HD)","unit":"Máy","quota":["Đáp ứng công suất sử dụng trung bình 02 ca/ngày: 01 Máy.","Ngoài ra:","Trung bình 05 Máy được bổ sung thêm 01 Máy.","Trường hợp cơ sở có đơn vị hồi sức: trung bình 05 giường hồi sức được bổ sung thêm 01 Máy."],"source_pages":[9],"source_ref":"Phụ lục, trang 9"},{"id":"10","tt":"10","type":"item","level":0,"parent":null,"name":"Máy thở xâm nhập","unit":"Máy","quota":["Định mức 01 Máy/giường hồi sức sau phẫu thuật; hồi sức tích cực; cấp cứu; sơ sinh.","Ngoài ra: Trung bình 06 Máy được bổ sung thêm 01 Máy."],"source_pages":[9],"source_ref":"Phụ lục, trang 9"},{"id":"11","tt":"11","type":"item","level":0,"parent":null,"name":"Máy thở xâm nhập di động","unit":"Máy","quota":["Định mức cho phòng mổ: 01 Máy/02 phòng mổ.","Ngoài ra: Định mức 01 Máy/05 giường hồi sức sau phẫu thuật; hồi sức tích cực; cấp cứu; sơ sinh."],"source_pages":[9],"source_ref":"Phụ lục, trang 9"},{"id":"12","tt":"12","type":"item","level":0,"parent":null,"name":"Máy gây mê","unit":"Máy","quota":["Định mức 01 Máy/bàn mổ.","Ngoài ra:","Trung bình 06 Máy được bổ sung thêm 01 Máy.","Trường hợp cơ sở có đơn vị sử dụng kỹ thuật gây mê hỗ trợ được bổ sung thêm 01 Máy/đơn vị."],"source_pages":[9],"source_ref":"Phụ lục, trang 9"},{"id":"13","tt":"13","type":"item","level":0,"parent":null,"name":"Máy theo dõi bệnh nhân ≥ 5 thông số","unit":"Máy","quota":["Định mức 01 Máy/05 giường nội trú.","Ngoài ra:","Được bổ sung thêm 01 Máy/bàn mổ.","Trường hợp cơ sở có giường hồi sức sau phẫu thuật; hồi sức tích cực; cấp cứu; thận nhân tạo: được bổ sung thêm 01 Máy/giường.","Trường hợp cơ sở có phòng thực hiện kỹ thuật can thiệp: được bổ sung thêm 01 Máy/phòng.","Trường hợp cơ sở có đơn vị thuộc lĩnh vực pháp y tâm thần: căn cứ nhu cầu thực tế để quyết định định mức sử dụng dựa trên giường bệnh hoặc đơn vị hồi sức cấp cứu để xác định theo nguyên tắc đảm bảo tiết kiệm, hiệu quả."],"source_pages":[9],"source_ref":"Phụ lục, trang 9"},{"id":"14","tt":"14","type":"item","level":0,"parent":null,"name":"Bơm tiêm điện","unit":"Cái","quota":["Định mức 01 Cái/05 giường nội trú.","Ngoài ra:","Được bổ sung thêm 05 Cái/bàn mổ.","Trường hợp cơ sở có giường hồi sức sau phẫu thuật: được bổ sung thêm tối đa 05 Cái/giường.","Trường hợp cơ sở có giường hồi sức tích cực; cấp cứu: được bổ sung thêm tối đa 10 Cái/giường.","Trường hợp cơ sở có giường điều trị bệnh nhân ngoại trú chuyên khoa nhi; ung bướu; huyết học: được bổ sung thêm tối đa 02 Cái/giường."],"source_pages":[10],"source_ref":"Phụ lục, trang 10"},{"id":"15","tt":"15","type":"item","level":0,"parent":null,"name":"Máy truyền dịch","unit":"Máy","quota":["Định mức 01 Máy/05 giường nội trú.","Ngoài ra:","Được bổ sung thêm 05 Máy/bàn mổ.","Trường hợp cơ sở có giường hồi sức sau phẫu thuật: được bổ sung thêm tối đa 05 Máy/giường","Trường hợp cơ sở có giường hồi sức tích cực; cấp cứu: được bổ sung thêm tối đa 05 Máy/giường.","Trường hợp cơ sở có giường điều trị bệnh nhân ngoại trú chuyên khoa nhi; ung bướu; huyết học: được bổ sung thêm tối đa 02 Máy/giường."],"source_pages":[10],"source_ref":"Phụ lục, trang 10"},{"id":"16","tt":"16","type":"section","level":0,"parent":null,"name":"Dao mổ","unit":null,"quota":null,"source_pages":[10],"source_ref":"Phụ lục, trang 10"},{"id":"16a","tt":"a","type":"item","level":1,"parent":"16","name":"Dao mổ điện cao tần","unit":"Cái","quota":["Định mức 01 Cái/01 bàn mổ.","Ngoài ra:","Được bổ sung thêm 01 Cái/01 phòng thủ thuật.","Trung bình 05 Cái được bổ sung thêm 01 Cái."],"source_pages":[10],"source_ref":"Phụ lục, trang 10"},{"id":"16b","tt":"b","type":"item","level":1,"parent":"16","name":"Dao mổ siêu âm/ Dao hàn mạch/ Dao hàn mô","unit":"Cái","quota":["Định mức: 01 Cái/phòng mổ.","Ngoài ra: Trung bình 05 Cái được bổ sung thêm 01 Cái."],"source_pages":[10],"source_ref":"Phụ lục, trang 10"},{"id":"17","tt":"17","type":"item","level":0,"parent":null,"name":"Máy phá rung tim","unit":"Máy","quota":["Định mức 01 Máy/Phòng mổ.","Ngoài ra:","Được bổ sung thêm: 01 Máy/10 giường hồi sức, cấp cứu; chống độc.","Được bổ sung thêm: 01 Máy/đơn vị tim mạch.","Được bổ sung thêm: 01 Máy/phòng DSA.","Được bổ sung thêm: 01 Máy/đơn vị nội trú khác.","Được bổ sung thêm: 01 Máy/đơn vị khám ngoại trú; đơn vị điều trị trong ngày."],"source_pages":[10],"source_ref":"Phụ lục, trang 10"},{"id":"18","tt":"18","type":"item","level":0,"parent":null,"name":"Hệ thống phẫu thuật nội soi","unit":"Hệ thống","quota":["Định mức 01 Hệ thống/bàn mổ có mổ nội soi.","Ngoài ra: Trung bình 05 Hệ thống được bổ sung thêm 01 Hệ thống."],"source_pages":[11],"source_ref":"Phụ lục, trang 11"},{"id":"19","tt":"19","type":"item","level":0,"parent":null,"name":"Đèn mổ treo trần","unit":"Cái","quota":["Định mức 01 Cái/bàn mổ."],"source_pages":[11],"source_ref":"Phụ lục, trang 11"},{"id":"20","tt":"20","type":"item","level":0,"parent":null,"name":"Đèn mổ di động","unit":"Cái","quota":["Định mức tối đa 01 Cái/phòng tiểu phẫu; khoa hồi sức; khoa cấp cứu."],"source_pages":[11],"source_ref":"Phụ lục, trang 11"},{"id":"21","tt":"21","type":"item","level":0,"parent":null,"name":"Bàn mổ","unit":"Cái","quota":["Định mức 01 Cái/phòng mổ."],"source_pages":[11],"source_ref":"Phụ lục, trang 11"},{"id":"22","tt":"22","type":"item","level":0,"parent":null,"name":"Máy điện tim","unit":"Máy","quota":["Định mức 01 Máy/50 bệnh nhân khám ngoại trú/ngày.","Trường hợp cơ sở có đơn vị điều trị nội trú; cấp cứu; hồi sức tích cực; pháp y tâm thần: được bổ sung thêm 01 Máy/đơn vị."],"source_pages":[11],"source_ref":"Phụ lục, trang 11"},{"id":"23","tt":"23","type":"section","level":0,"parent":null,"name":"Hệ thống nội soi chẩn đoán","unit":null,"quota":null,"source_pages":[11,12],"source_ref":"Phụ lục, trang 11, 12"},{"id":"23a","tt":"a","type":"item","level":1,"parent":"23","name":"Hệ thống nội soi tiêu hóa (dạ dày, đại tràng)","unit":"Hệ thống","quota":["Nhu cầu trung bình dưới 100 ca/tháng/cơ sở: 01 Hệ thống/cơ sở.","Nhu cầu trung bình từ 100 đến 400 ca/tháng/cơ sở: tối đa 02 Hệ thống/cơ sở.","Nhu cầu trung bình trên 400 ca/tháng/cơ sở: Được bổ sung thêm 01 Hệ thống cho mỗi 200 ca tăng thêm/tháng/cơ sở.","Trường hợp cơ sở có đơn vị hồi sức; cấp cứu: được bổ sung thêm 01 Hệ thống/đơn vị."],"source_pages":[11],"source_ref":"Phụ lục, trang 11"},{"id":"23b","tt":"b","type":"item","level":1,"parent":"23","name":"Hệ thống nội soi khí quản, phế quản","unit":"Hệ thống","quota":["Nhu cầu trung bình dưới 100 ca/tháng/cơ sở: 01 Hệ thống/cơ sở.","Nhu cầu trung bình từ 100 đến 400 ca/tháng/cơ sở: tối đa 02 Hệ thống/cơ sở.","Nhu cầu trung bình trên 400 ca/tháng/cơ sở: Được bổ sung thêm 01 Hệ thống cho mỗi 200 ca tăng thêm/tháng/cơ sở.","Trường hợp cơ sở có đơn vị hồi sức; cấp cứu: Được bổ sung thêm 01 Hệ thống/đơn vị."],"source_pages":[11],"source_ref":"Phụ lục, trang 11"},{"id":"23c","tt":"c","type":"item","level":1,"parent":"23","name":"Hệ thống nội soi tai mũi họng","unit":"Hệ thống","quota":["Nhu cầu trung bình dưới 200 ca/tháng/cơ sở: 01 Hệ thống/cơ sở.","Nhu cầu trung bình từ 200 đến 1.800 ca/tháng/cơ sở tối đa 02 Hệ thống/cơ sở.","Nhu cầu trung bình trên 1.800 ca/tháng/cơ sở: Được bổ sung thêm 01 Hệ thống cho mỗi 900 ca tăng thêm/tháng/cơ sở.","Trường hợp cơ sở có bàn khám Tai mũi họng: được bổ sung thêm 01 Hệ thống/ bàn khám Tai mũi họng."],"source_pages":[12],"source_ref":"Phụ lục, trang 12"},{"id":"23d","tt":"d","type":"item","level":1,"parent":"23","name":"Hệ thống nội soi tiết niệu","unit":"Hệ thống","quota":["Nhu cầu trung bình dưới 100 ca/tháng/cơ sở: 01 Hệ thống/cơ sở.","Nhu cầu trung bình từ 100 đến 600 ca/ tháng/cơ sở: tối đa 02 Hệ thống /cơ sở.","Nhu cầu trung bình trên 600 ca/tháng/cơ sở: Được bổ sung thêm 01 Hệ thống cho mỗi 300 ca tăng thêm/tháng/cơ sở.","Trường hợp cơ sở có sử dụng máy tán sỏi: được bổ sung thêm 01 Hệ thống/máy tán sỏi."],"source_pages":[12],"source_ref":"Phụ lục, trang 12"},{"id":"24","tt":"24","type":"item","level":0,"parent":null,"name":"Máy soi cổ tử cung","unit":"Máy","quota":["Định mức 01 Máy/ 01 bàn khám phụ khoa."],"source_pages":[12],"source_ref":"Phụ lục, trang 12"},{"id":"25","tt":"25","type":"item","level":0,"parent":null,"name":"Máy theo dõi sản khoa 02 chức năng","unit":"Máy","quota":["Định mức 01 Máy/ 01 bàn đẻ.","Trường hợp cơ sở có giường nội trú theo dõi sản khoa: được bổ sung thêm 01 Máy/10 giường nội trú theo dõi sản khoa."],"source_pages":[12],"source_ref":"Phụ lục, trang 12"},{"id":"26","tt":"26","type":"item","level":0,"parent":null,"name":"Máy và ghế nha khoa","unit":"Bộ","quota":["Định mức 01 Bộ/01 vị trí khám, điều trị nha khoa."],"source_pages":[12],"source_ref":"Phụ lục, trang 12"}],"footnotes":["¹ Tiêu chuẩn, định mức không phụ thuộc số lượng máy xét nghiệm. Áp dụng tương tự đối với các Máy xét nghiệm khác.","* Đơn vị quy định tại Phụ lục này là bộ phận hoạt động chuyên môn thực hiện một hoặc một số lĩnh vực chuyên môn y tế thuộc cơ cấu tổ chức của đơn vị sự nghiệp công lập trong lĩnh vực y tế.","** Định mức sử dụng được xác định theo nguyên tắc làm tròn số lên. Áp dụng nguyên tắc làm tròn số lên cho tất cả thiết bị y tế khi tính định mức."],"notes":"Cấu trúc được tái tạo từ bảng ở trang 6-12. Nội dung quota được giữ theo văn bản, chỉ chuẩn hóa ngắt dòng do layout PDF. Các section row (1, 2, 5, 16, 23) được giữ riêng để React có thể render colspan."}$appendix$::JSONB;
BEGIN
  INSERT INTO public.device_quota_regulatory_documents (
    document_number,
    document_title,
    appendix_title,
    document_version,
    issued_date,
    effective_date,
    source_pdf_path,
    source_pdf_sha256
  )
  VALUES (
    '10/2026/TT-BYT',
    'Thông tư 10/2026/TT-BYT',
    'Phụ lục - Tiêu chuẩn, định mức sử dụng máy móc, thiết bị chuyên dùng trong lĩnh vực y tế',
    '2026-05-14',
    '2026-05-14'::DATE,
    '2026-07-01'::DATE,
    '757_Thong-tu-10-2026-TT-BYT_88e68354fb.pdf',
    '04186bd3cc50cf541f5e481d25480741412cfe3c899040c35713d4eeda24fd8f'
  )
  RETURNING id INTO v_document_id;

  INSERT INTO public.device_quota_regulatory_catalog_versions (
    document_id,
    artifact_id,
    appendix_json_path,
    appendix_json_sha256,
    appendix_markdown_path,
    appendix_markdown_sha256,
    extraction_revision,
    import_status,
    is_canonical,
    source_pages,
    source_note,
    expected_structural_rows,
    expected_section_rows,
    expected_item_rows,
    expected_child_item_rows,
    expected_top_level_item_rows,
    expected_rule_lines,
    expected_footnotes,
    expected_items_with_source_pages,
    expected_items_with_source_references,
    expected_multiline_items
  )
  VALUES (
    v_document_id,
    'thong-tu-10-2026-appendix-freeze',
    'thong-tu-10-2026-appendix.json',
    '01aac96335d83fd51ca45e9bce0b03c20ec3a333822151f320ac22948cc9b438',
    'thong-tu-10-2026-appendix.md',
    '1ac4b38c14675b2de065c13c09036b89c92de87c17da840776e351f67761c4ca',
    'phase-0-2026-08-31-r1',
    'loading',
    false,
    '6-12',
    'The PDF is the legal ground truth. JSON and Markdown are structural transcriptions used for traceable source inspection.',
    42,
    5,
    37,
    16,
    21,
    113,
    3,
    37,
    37,
    32
  )
  RETURNING id INTO v_version_id;

  FOR v_row IN
    SELECT value
    FROM jsonb_array_elements(v_appendix->'rows') WITH ORDINALITY AS rows(value, ordinality)
    ORDER BY rows.ordinality
  LOOP
    v_source_order := v_source_order + 1;
    v_section_id := NULL;
    v_item_id := NULL;

    IF v_row->>'type' = 'section' THEN
      INSERT INTO public.device_quota_regulatory_sections (
        catalog_version_id,
        source_identifier,
        source_label,
        name,
        source_order
      )
      VALUES (
        v_version_id,
        v_row->>'id',
        v_row->>'tt',
        v_row->>'name',
        v_source_order
      )
      RETURNING id INTO v_section_id;
    ELSE
      SELECT s.id
      INTO v_section_id
      FROM public.device_quota_regulatory_sections AS s
      WHERE s.catalog_version_id = v_version_id
        AND s.source_identifier = v_row->>'parent';

      INSERT INTO public.device_quota_regulatory_items (
        catalog_version_id,
        section_id,
        source_identifier,
        source_label,
        name,
        original_unit,
        quota_lines,
        source_order
      )
      VALUES (
        v_version_id,
        v_section_id,
        v_row->>'id',
        v_row->>'tt',
        v_row->>'name',
        v_row->>'unit',
        COALESCE(
          ARRAY(
            SELECT jsonb_array_elements_text(v_row->'quota')
          ),
          '{}'::TEXT[]
        ),
        v_source_order
      )
      RETURNING id INTO v_item_id;

      FOR v_line, v_ordinality IN
        SELECT value, ordinality::INTEGER
        FROM jsonb_array_elements_text(v_row->'quota') WITH ORDINALITY AS quota(value, ordinality)
      LOOP
        INSERT INTO public.device_quota_regulatory_rules (
          item_id,
          line_order,
          source_text
        )
        VALUES (v_item_id, v_ordinality, v_line);
      END LOOP;
    END IF;

    INSERT INTO public.device_quota_regulatory_source_positions (
      catalog_version_id,
      source_identifier,
      source_label,
      row_type,
      source_level,
      parent_source_identifier,
      source_order,
      section_id,
      item_id
    )
    VALUES (
      v_version_id,
      v_row->>'id',
      v_row->>'tt',
      v_row->>'type',
      (v_row->>'level')::INTEGER,
      v_row->>'parent',
      v_source_order,
      v_section_id,
      v_item_id
    )
    RETURNING id INTO v_position_id;

    FOR v_page IN
      SELECT value::INTEGER
      FROM jsonb_array_elements_text(v_row->'source_pages')
    LOOP
      INSERT INTO public.device_quota_regulatory_source_pages (
        source_position_id,
        page_number,
        page_order
      )
      VALUES (
        v_position_id,
        v_page,
        (SELECT count(*)::INTEGER + 1
         FROM public.device_quota_regulatory_source_pages
         WHERE source_position_id = v_position_id)
      );
    END LOOP;

    INSERT INTO public.device_quota_regulatory_references (
      catalog_version_id,
      source_position_id,
      reference_type,
      reference_order,
      reference_text
    )
    VALUES (
      v_version_id,
      v_position_id,
      'source',
      v_source_order,
      v_row->>'source_ref'
    );
  END LOOP;

  FOR v_line, v_ordinality IN
    SELECT value, ordinality::INTEGER
    FROM jsonb_array_elements_text(v_appendix->'footnotes') WITH ORDINALITY AS footnotes(value, ordinality)
  LOOP
    INSERT INTO public.device_quota_regulatory_references (
      catalog_version_id,
      source_position_id,
      reference_type,
      reference_order,
      reference_text
    )
    VALUES (v_version_id, NULL, 'footnote', v_ordinality, v_line);
  END LOOP;

  UPDATE public.device_quota_regulatory_catalog_versions
  SET import_status = 'ready',
      is_canonical = true
  WHERE id = v_version_id;
END;
$seed$;

CREATE OR REPLACE FUNCTION public.device_quota_regulatory_catalog_get()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_claims JSONB;
  v_role TEXT;
  v_effective_role TEXT;
  v_user_id BIGINT;
  v_don_vi BIGINT;
  v_user_id_text TEXT;
  v_don_vi_text TEXT;
  v_version_id UUID;
  v_canonical_count INTEGER;
BEGIN
  BEGIN
    v_claims := COALESCE(
      NULLIF(current_setting('request.jwt.claims', true), ''),
      '{}'
    )::JSONB;
    v_role := NULLIF(v_claims->>'app_role', '');
    v_user_id_text := NULLIF(v_claims->>'user_id', '');
    v_don_vi_text := NULLIF(
      v_claims->>'don_vi',
      ''
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Missing or malformed JWT claims' USING errcode = '42501';
  END;

  IF v_role IS NULL OR v_user_id_text IS NULL THEN
    RAISE EXCEPTION 'Missing authenticated identity claims' USING errcode = '42501';
  END IF;

  v_effective_role := CASE
    WHEN v_role = 'admin' THEN 'global'
    ELSE v_role
  END;

  IF v_effective_role IS NULL OR v_effective_role NOT IN ('global', 'to_qltb') THEN
    RAISE EXCEPTION 'Insufficient permissions for regulatory catalog access'
      USING errcode = '42501';
  END IF;

  IF v_user_id_text !~ '^[0-9]+$' THEN
    RAISE EXCEPTION 'Missing user_id claim' USING errcode = '42501';
  END IF;

  IF v_don_vi_text IS NULL OR v_don_vi_text !~ '^[0-9]+$' THEN
    RAISE EXCEPTION 'Missing tenant claim' USING errcode = '42501';
  END IF;

  BEGIN
    v_user_id := v_user_id_text::BIGINT;
    v_don_vi := v_don_vi_text::BIGINT;
  EXCEPTION WHEN numeric_value_out_of_range THEN
    RAISE EXCEPTION 'Invalid session identity claims' USING errcode = '42501';
  END;

  IF NOT EXISTS (
    SELECT 1
    FROM public.nhan_vien AS nv
    WHERE nv.id = v_user_id
      AND COALESCE(nv.is_active, true)
      AND COALESCE(nv.current_don_vi, nv.don_vi) = v_don_vi
      AND CASE WHEN nv.role = 'admin' THEN 'global' ELSE nv.role END = v_effective_role
  ) THEN
    RAISE EXCEPTION 'Session user or tenant is not authorized'
      USING errcode = '42501';
  END IF;

  SELECT count(*)::INTEGER
  INTO v_canonical_count
  FROM public.device_quota_regulatory_catalog_versions AS v
  JOIN public.device_quota_regulatory_documents AS d ON d.id = v.document_id
  WHERE d.document_number = '10/2026/TT-BYT'
    AND v.import_status = 'ready'
    AND v.is_canonical
      AND device_quota_internal.catalog_is_complete(v.id);

  IF v_canonical_count <> 1 THEN
    RAISE EXCEPTION 'Canonical regulatory catalog snapshot is unavailable or invalid'
      USING errcode = '55000';
  END IF;

  SELECT v.id
  INTO v_version_id
  FROM public.device_quota_regulatory_catalog_versions AS v
  JOIN public.device_quota_regulatory_documents AS d ON d.id = v.document_id
  WHERE d.document_number = '10/2026/TT-BYT'
    AND v.import_status = 'ready'
    AND v.is_canonical
    AND device_quota_internal.catalog_is_complete(v.id)
  LIMIT 1;

  RETURN (
    SELECT jsonb_build_object(
      'document',
      jsonb_build_object(
        'document_number', d.document_number,
        'document_title', d.document_title,
        'appendix_title', d.appendix_title,
        'document_version', d.document_version,
        'issued_date', d.issued_date,
        'effective_date', d.effective_date,
        'source_pdf_path', d.source_pdf_path,
        'source_pdf_sha256', d.source_pdf_sha256
      ),
      'catalog_version',
      jsonb_build_object(
        'artifact_id', v.artifact_id,
        'appendix_json_path', v.appendix_json_path,
        'appendix_json_sha256', v.appendix_json_sha256,
        'appendix_markdown_path', v.appendix_markdown_path,
        'appendix_markdown_sha256', v.appendix_markdown_sha256,
        'extraction_revision', v.extraction_revision,
        'import_status', v.import_status,
        'is_canonical', v.is_canonical,
        'source_pages', v.source_pages,
        'source_note', v.source_note
      ),
      'completeness',
      jsonb_build_object(
        'structural_rows', v.expected_structural_rows,
        'section_rows', v.expected_section_rows,
        'equipment_item_rows', v.expected_item_rows,
        'source_declared_child_rows', v.expected_child_item_rows,
        'top_level_item_rows', v.expected_top_level_item_rows,
        'rule_lines', v.expected_rule_lines,
        'footnotes', v.expected_footnotes,
        'items_with_source_pages', v.expected_items_with_source_pages,
        'items_with_source_references', v.expected_items_with_source_references,
        'multiline_quota_items', v.expected_multiline_items
      ),
      'rows',
      (
        SELECT COALESCE(
          jsonb_agg(
            jsonb_build_object(
              'id', p.source_identifier,
              'tt', p.source_label,
              'type', p.row_type,
              'level', p.source_level,
              'parent', p.parent_source_identifier,
              'name', COALESCE(s.name, i.name),
              'unit', i.original_unit,
              'quota', CASE
                WHEN i.id IS NULL THEN NULL
                ELSE to_jsonb(i.quota_lines)
              END,
              'source_pages',
              (
                SELECT jsonb_agg(sp.page_number ORDER BY sp.page_order)
                FROM public.device_quota_regulatory_source_pages AS sp
                WHERE sp.source_position_id = p.id
              ),
              'source_ref',
              (
                SELECT r.reference_text
                FROM public.device_quota_regulatory_references AS r
                WHERE r.source_position_id = p.id
                  AND r.reference_type = 'source'
              )
            )
            ORDER BY p.source_order
          ),
          '[]'::JSONB
        )
        FROM public.device_quota_regulatory_source_positions AS p
        LEFT JOIN public.device_quota_regulatory_sections AS s ON s.id = p.section_id
        LEFT JOIN public.device_quota_regulatory_items AS i ON i.id = p.item_id
        WHERE p.catalog_version_id = v.id
      ),
      'footnotes',
      (
        SELECT COALESCE(
          jsonb_agg(r.reference_text ORDER BY r.reference_order),
          '[]'::JSONB
        )
        FROM public.device_quota_regulatory_references AS r
        WHERE r.catalog_version_id = v.id
          AND r.reference_type = 'footnote'
      )
    )
    FROM public.device_quota_regulatory_catalog_versions AS v
    JOIN public.device_quota_regulatory_documents AS d ON d.id = v.document_id
    WHERE v.id = v_version_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.device_quota_regulatory_catalog_get()
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.device_quota_regulatory_catalog_get()
  TO authenticated;

COMMIT;
