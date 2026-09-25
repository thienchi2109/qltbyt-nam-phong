package qltbyt

import (
	"encoding/json"
	"fmt"
	"strings"

	"example.com/shared-ai-service/internal/capability"
	"example.com/shared-ai-service/internal/protocol"
)

const repairDraftReviewNote = "Đây là bản nháp do AI trợ lý tạo. Vui lòng kiểm tra kỹ trước khi gửi."

func (a Assistant) repairFollowUp(request protocol.Request, primary capability.PrimaryOutput) capability.FollowUp {
	active, start := repairDraftSession(request.Messages)
	if !active {
		return capability.FollowUp{}
	}
	evidence := collectDraftEvidence(request.Messages[start:], primary.ToolResults)
	if evidence.resolution != "single" || evidence.equipment == nil {
		return capability.FollowUp{}
	}
	prompt := buildRepairExtractionPrompt(draftTranscript(request.Messages[start:], primary.ToolResults), *evidence.equipment)
	if !a.reserveExtraction(request.RequestID, prompt) {
		return capability.FollowUp{}
	}
	equipment := *evidence.equipment
	refs := append([]string(nil), evidence.refs...)
	return capability.FollowUp{
		Extraction: []protocol.Message{{Role: protocol.RoleUser, Content: prompt}},
		MapExtraction: func(text string) ([]protocol.Artifact, error) {
			artifact, ok := repairArtifactFromExtraction(text, equipment, refs)
			if !ok {
				return nil, nil
			}
			return []protocol.Artifact{artifact}, nil
		},
	}
}

func draftTranscript(messages []protocol.Message, tools []capability.ToolResult) string {
	var lines []string
	for _, message := range messages {
		text := strings.TrimSpace(modelFacingOutput(message.Content))
		if text == "" {
			continue
		}
		switch message.Role {
		case protocol.RoleUser:
			lines = append(lines, "USER: "+text)
		case protocol.RoleAssistant:
			lines = append(lines, "ASSISTANT: "+text)
		case protocol.RoleTool:
			name := message.Name
			if name == "" {
				name = "tool"
			}
			lines = append(lines, "TOOL "+name+": "+text)
		}
	}
	for _, tool := range tools {
		text := strings.TrimSpace(modelFacingOutput(tool.Output))
		if text == "" {
			continue
		}
		lines = append(lines, "TOOL "+tool.Name+": "+text)
	}
	return strings.Join(lines, "\n")
}

func buildRepairExtractionPrompt(transcript string, equipment draftEquipment) string {
	lines := []string{
		"Trích xuất dữ liệu bản nháp yêu cầu sửa chữa từ hội thoại sau.",
		"Chỉ dùng thông tin mà người dùng nói rõ trong hội thoại.",
		"KHÔNG suy luận mo_ta_su_co hoặc hang_muc_sua_chua từ metadata thiết bị hoặc lịch sử sửa chữa.",
		"Nếu người dùng chưa cung cấp một trường bắt buộc, trả về null cho trường đó và thêm tên trường vào missingRequiredFields.",
		`Chỉ trả ten_don_vi_thue khi don_vi_thuc_hien = "thue_ngoai" và người dùng nêu rõ tên đơn vị.`,
		"",
		"Thiết bị đã được route xác định:",
		fmt.Sprintf("- thiet_bi_id: %d", equipment.ID),
	}
	if equipment.Code != "" {
		lines = append(lines, "- ma_thiet_bi: "+equipment.Code)
	}
	if equipment.Name != "" {
		lines = append(lines, "- ten_thiet_bi: "+equipment.Name)
	}
	if strings.TrimSpace(transcript) == "" {
		transcript = "(không có nội dung hội thoại)"
	}
	lines = append(lines, "", "Hội thoại:", transcript)
	return strings.Join(lines, "\n")
}

type extractionFields struct {
	Incident *string  `json:"mo_ta_su_co"`
	Work     *string  `json:"hang_muc_sua_chua"`
	Due      *string  `json:"ngay_mong_muon_hoan_thanh"`
	Unit     *string  `json:"don_vi_thuc_hien"`
	Vendor   *string  `json:"ten_don_vi_thue"`
	Missing  []string `json:"missingRequiredFields"`
}

func repairArtifactFromExtraction(text string, equipment draftEquipment, refs []string) (protocol.Artifact, bool) {
	parsed, ok := parseExtraction(text)
	if !ok {
		return protocol.Artifact{}, false
	}
	incident := normalizeDraftString(parsed.Incident)
	work := normalizeDraftString(parsed.Work)
	if incident == nil || work == nil {
		return protocol.Artifact{}, false
	}
	unit, valid := normalizeDraftUnit(parsed.Unit)
	if !valid {
		return protocol.Artifact{}, false
	}
	var vendor *string
	if unit != nil && *unit == "thue_ngoai" {
		vendor = normalizeDraftString(parsed.Vendor)
	}
	if _, hasLookup := filterDraftRefs(refs); !hasLookup {
		return protocol.Artifact{}, false
	}
	payload := repairDraftPayload{
		Kind:       RepairRequestDraftKind,
		DraftOnly:  true,
		Source:     "assistant",
		Confidence: "medium",
		Equipment: repairDraftEquipment{
			ID:   equipment.ID,
			Code: equipment.Code,
			Name: equipment.Name,
		},
		FormData: repairDraftForm{
			EquipmentID: equipment.ID,
			Incident:    *incident,
			Work:        *work,
			Due:         normalizeDraftString(parsed.Due),
			Unit:        unit,
			Vendor:      vendor,
		},
		MissingFields: []string{},
		ReviewNotes:   []string{repairDraftReviewNote},
	}
	encoded, err := json.Marshal(payload)
	if err != nil {
		return protocol.Artifact{}, false
	}
	return protocol.Artifact{Name: RepairRequestDraftKind, Payload: encoded}, true
}

func parseExtraction(text string) (extractionFields, bool) {
	text = strings.TrimSpace(text)
	if strings.HasPrefix(text, "```") {
		text = strings.TrimPrefix(text, "```json")
		text = strings.TrimPrefix(text, "```")
		text = strings.TrimSuffix(strings.TrimSpace(text), "```")
		text = strings.TrimSpace(text)
	}
	var parsed extractionFields
	if err := json.Unmarshal([]byte(text), &parsed); err != nil {
		return extractionFields{}, false
	}
	return parsed, true
}

func normalizeDraftString(value *string) *string {
	if value == nil {
		return nil
	}
	trimmed := strings.TrimSpace(*value)
	if trimmed == "" {
		return nil
	}
	return &trimmed
}

func normalizeDraftUnit(value *string) (*string, bool) {
	if value == nil {
		return nil, true
	}
	switch strings.TrimSpace(*value) {
	case "", "null":
		return nil, true
	case "noi_bo", "thue_ngoai":
		unit := strings.TrimSpace(*value)
		return &unit, true
	default:
		return nil, false
	}
}

func filterDraftRefs(refs []string) ([]string, bool) {
	seen := map[string]struct{}{}
	valid := make([]string, 0, len(refs))
	for _, ref := range refs {
		if !draftEligible(ref) {
			continue
		}
		if _, ok := seen[ref]; ok {
			continue
		}
		seen[ref] = struct{}{}
		valid = append(valid, ref)
	}
	_, ok := seen["equipmentLookup"]
	return valid, ok
}

type repairDraftPayload struct {
	Kind          string               `json:"kind"`
	DraftOnly     bool                 `json:"draftOnly"`
	Source        string               `json:"source"`
	Confidence    string               `json:"confidence"`
	Equipment     repairDraftEquipment `json:"equipment"`
	FormData      repairDraftForm      `json:"formData"`
	MissingFields []string             `json:"missingFields"`
	ReviewNotes   []string             `json:"reviewNotes"`
}

type repairDraftEquipment struct {
	ID   int64  `json:"thiet_bi_id"`
	Code string `json:"ma_thiet_bi,omitempty"`
	Name string `json:"ten_thiet_bi,omitempty"`
}

type repairDraftForm struct {
	EquipmentID int64   `json:"thiet_bi_id"`
	Incident    string  `json:"mo_ta_su_co"`
	Work        string  `json:"hang_muc_sua_chua"`
	Due         *string `json:"ngay_mong_muon_hoan_thanh"`
	Unit        *string `json:"don_vi_thuc_hien"`
	Vendor      *string `json:"ten_don_vi_thue"`
}
