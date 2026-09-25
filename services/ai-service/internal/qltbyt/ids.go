package qltbyt

import "time"

const (
	AppID        = "qltbyt"
	CapabilityID = "assistant-chat"
	Version      = "v1"

	PromptVersion = "v2.6.1"

	BrokerIssuer   = "nextjs-bff"
	BrokerAudience = "qltbyt-rpc-broker-v1"
	BrokerMaxTTL   = 120 * time.Second
	CleanupMax     = 5 * time.Second

	QueryToolName       = "query_database"
	QuerySearchPath     = "ai_readonly, pg_catalog"
	QueryTimeout        = 5 * time.Second
	QueryMaxRows        = 100
	QueryMaxPayload     = 64 * 1024
	QueryShapeMax       = 1000
	CompactedInputLimit = 40_000

	TroubleshootingDraftKind = "troubleshootingDraft"
	RepairRequestDraftKind   = "repairRequestDraft"
	ToolTroubleshootingDraft = "generateTroubleshootingDraft"
	ToolRepairRequestDraft   = "generateRepairRequestDraft"
	ToolSystemDiagnostics    = "systemDiagnostics"

	RPCAudit         = "assistant_query_database_audit_log"
	RPCQuotaReserve  = "ai_quota_reserve"
	RPCQuotaFinalize = "ai_quota_finalize"

	FacilityRequiredMessage   = "Anh/chị vui lòng chọn cơ sở y tế tại bộ lọc đơn vị trên thanh điều hướng (phía trên bên trái màn hình) trước khi sử dụng trợ lý tra cứu."
	UnresolvedFacilityMessage = "Unable to resolve facility context for tool execution."

	RepairClarification    = "Anh/chị muốn xem trạng thái thiết bị hay tình trạng các yêu cầu sửa chữa/phiếu sửa chữa?"
	QuotaClarification     = "Anh/chị muốn kiểm tra định mức cho một thiết bị cụ thể hay xem tổng quan định mức của đơn vị?"
	EquipmentClarification = "Anh/chị muốn tra cứu thiết bị nào? Vui lòng cung cấp tên thiết bị cụ thể, mã thiết bị, model hoặc số serial trước khi tôi tra cứu."
	MixedClarification     = "Anh/chị muốn ưu tiên ý chính nào: sửa chữa, định mức, hay tra cứu thiết bị? Vui lòng chọn một nội dung trước để tôi dùng đúng công cụ."
)

const QueryDatabasePromptPointer = "Khi dùng `query_database`: chỉ viết đúng một câu `SELECT` trên các view equipment_search, maintenance_facts, repair_facts, usage_facts, quota_facts. " +
	"Khoa/phòng nằm ở cột `khoa_phong_quan_ly`. " +
	"Nếu người dùng hỏi theo `người quản lý trực tiếp`, `người sử dụng`, `người phụ trách`, hoặc cá nhân trực tiếp quản lý thiết bị, PHẢI dùng cột `nguoi_dang_truc_tiep_quan_ly` và KHÔNG thay bằng `khoa_phong_quan_ly`. " +
	"Chỉ dùng `khoa_phong_quan_ly` khi người dùng hỏi rõ theo khoa, phòng, hoặc đơn vị quản lý. " +
	"Các chiều thống kê thiết bị phổ biến đã được công bố trong `equipment_search`, bao gồm `nguoi_dang_truc_tiep_quan_ly`, `vi_tri_lap_dat`, `phan_loai_theo_nd98`, `hang_san_xuat`, `noi_san_xuat`, `nguon_nhap`, `nguon_kinh_phi`, `nam_san_xuat`, `gia_goc`. " +
	"Với câu hỏi theo ngày/tháng/quý/năm, ưu tiên dùng các cột chuẩn hóa như `ngay_nhap_date`, `ngay_nhap_year`, `ngay_nhap_month`, `ngay_nhap_quarter`, `ngay_dua_vao_su_dung_date`, `ngay_dua_vao_su_dung_year`, `ngay_dua_vao_su_dung_month`, `ngay_dua_vao_su_dung_quarter`, `ngay_ngung_su_dung_date`, `ngay_ngung_su_dung_year`, `ngay_ngung_su_dung_month`, `ngay_ngung_su_dung_quarter`. " +
	"KHÔNG dùng raw schema/tên như thiet_bi, khoa_phong, public.*, auth.*, pg_catalog.*, set_config."
