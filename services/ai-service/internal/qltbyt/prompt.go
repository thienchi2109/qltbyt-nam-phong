package qltbyt

import (
	_ "embed"
	"strconv"
	"strings"
)

//go:embed system_prompt.txt
var systemPromptTemplate string

type promptInput struct {
	Role           string
	FacilityID     int64
	FacilityName   string
	PrivilegedRole bool
}

func buildSystemPrompt(input promptInput) string {
	role := normalizePromptRole(input.Role)
	facility := "unspecified"
	if input.FacilityID > 0 {
		facility = strconv.FormatInt(input.FacilityID, 10)
	}
	label := facility
	name := strings.TrimSpace(input.FacilityName)
	if name != "" && facility != "unspecified" {
		label = name + " (ID: " + facility + ")"
	}
	block := ""
	if input.PrivilegedRole {
		block = "  + ⚠️ Các tool tra cứu hiện tại chỉ trả dữ liệu **cơ sở đang chọn trên thanh điều hướng**.\n" +
			"  + Nếu người dùng hỏi về cơ sở khác, hãy hướng dẫn: *\"Anh/chị vui lòng đổi cơ sở trên thanh điều hướng (phía trên bên trái) → chọn [tên cơ sở cần tra cứu] → sau đó hỏi lại câu hỏi. Phiên chat này vẫn tiếp tục, nhưng lưu ý rằng kết quả từ các tin nhắn trước vẫn hiển thị dữ liệu của cơ sở cũ.\"*\n" +
			"  + KHÔNG tự từ chối hoặc nói \"không có quyền\" — chỉ hướng dẫn đổi cơ sở.\n"
	}
	replacer := strings.NewReplacer(
		"{{ROLE}}", role,
		"{{ROLE_LABEL}}", promptRoleLabel(role),
		"{{FACILITY_LABEL}}", label,
		"{{PRIVILEGED_BLOCK}}", block,
		"{{QUERY_POINTER}}", QueryDatabasePromptPointer,
	)
	return replacer.Replace(systemPromptTemplate)
}

func normalizePromptRole(role string) string {
	normalized := strings.ToLower(strings.TrimSpace(role))
	if normalized == "" || !allowedPromptRoles[normalized] {
		return "unknown"
	}
	return normalized
}

func promptRoleLabel(role string) string {
	if label, ok := promptRoleLabels[role]; ok {
		return label
	}
	return promptRoleLabels["unknown"]
}

func promptPrivileged(role string) bool {
	switch normalizePromptRole(role) {
	case "global", "admin", "regional_leader":
		return true
	default:
		return false
	}
}

var allowedPromptRoles = map[string]bool{
	"global": true, "admin": true, "chuyen_gia": true, "regional_leader": true,
	"to_qltb": true, "technician": true, "qltb_khoa": true, "user": true,
}

var promptRoleLabels = map[string]string{
	"global":          "Quản trị hệ thống (toàn quyền)",
	"admin":           "Quản trị hệ thống (toàn quyền)",
	"regional_leader": "Sở Y tế (giám sát nhiều cơ sở)",
	"to_qltb":         "Tổ/Phòng Vật tư – Thiết bị Y tế (quản lý thiết bị cơ sở)",
	"technician":      "Kỹ thuật viên (bảo trì, sửa chữa)",
	"qltb_khoa":       "Quản lý thiết bị khoa/phòng",
	"user":            "Nhân viên (chỉ xem)",
	"unknown":         "Chưa xác định",
}
