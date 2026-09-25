package qltbyt

import (
	"regexp"
	"strings"

	"example.com/shared-ai-service/internal/protocol"
)

var (
	draftStartPhrases = []string{
		"tạo phiếu sửa chữa",
		"tạo phiếu yêu cầu sửa chữa thiết bị",
		"lập yêu cầu sửa chữa",
		"soạn yêu cầu sửa chữa",
		"điền trước form sửa chữa",
	}
	draftCancelPhrases = []string{
		"thôi không tạo nữa",
		"hủy tạo phiếu",
		"không cần tạo phiếu",
	}
	repairWorkflowPattern    = regexp.MustCompile(`\b(xu ly|tiep nhan|ton dong|dang mo|da dong|hoan thanh)\b`)
	repairRequestPattern     = regexp.MustCompile(`\b(phieu|yeu cau|don|ticket)\b`)
	equipmentStatusPattern   = regexp.MustCompile(`\b(trang thai|tinh trang|cho sua chua|dang sua chua|hong)\b`)
	equipmentCountPattern    = regexp.MustCompile(`\bbao nhieu thiet bi\b`)
	quotaWordPattern         = regexp.MustCompile(`\b(dinh muc|quota)\b`)
	specificEquipmentPattern = regexp.MustCompile(`\b(thiet bi nay|may nay|ma thiet bi|ma may|serial|model|mot thiet bi cu the)\b`)
	facilitySummaryPattern   = regexp.MustCompile(`\b(don vi|co so|benh vien|trung tam|tong quan|tong hop|bao nhieu thiet bi|vuot dinh muc|thieu dinh muc|chua gan)\b`)
	lookupIntentPattern      = regexp.MustCompile(`\b(tra cuu|tim|xem|kiem tra|thong tin|chi tiet|ho so)\b`)
	equipmentWordPattern     = regexp.MustCompile(`\b(thiet bi|may)\b`)
	reportingIntentPattern   = regexp.MustCompile(`\b(bao cao|thong ke|tong hop|phan bo|top|xep hang|xu huong|ty le)\b`)
	reportingSubjectPattern  = regexp.MustCompile(`\b(thiet bi|bao tri|hieu chuan|kiem dinh|sua chua|su dung|dinh muc|trang thai|don vi|co so|khoa|phong)\b`)
	maintenancePattern       = regexp.MustCompile(`\b(bao tri|hieu chuan|ke hoach bao tri|den han)\b`)
	repairMentionPattern     = regexp.MustCompile(`\b(sua chua|phieu sua chua|yeu cau sua chua|hong|su co)\b`)
	usagePattern             = regexp.MustCompile(`\b(lich su su dung|su dung)\b`)
	attachmentPattern        = regexp.MustCompile(`\b(tai lieu|dinh kem|file|huong dan)\b`)
	repairWordPattern        = regexp.MustCompile(`\bsua chua\b`)
)

type routeResult struct {
	Clarify string
	Tools   []string
}

func routeIntent(messages []protocol.Message, requested []string) routeResult {
	nonSQL := holdBackQueryDatabase(requested)
	text := latestUserText(messages)
	if text == "" {
		return routeResult{Tools: nonSQL}
	}
	repair := classifyRepair(text, nonSQL)
	if draftIntent(text) == "start" && repair != nil {
		return *repair
	}
	decisions := make([]routeResult, 0, 3)
	if repair != nil {
		decisions = append(decisions, *repair)
	}
	if quota := classifyQuota(text, nonSQL); quota != nil {
		decisions = append(decisions, *quota)
	}
	if equipment := classifyEquipment(text, nonSQL); equipment != nil {
		decisions = append(decisions, *equipment)
	}
	if len(decisions) > 1 {
		return routeResult{Clarify: MixedClarification}
	}
	if len(decisions) == 1 {
		return decisions[0]
	}
	if sql := classifySQL(text, requested); sql != nil {
		return *sql
	}
	if everyQueryDatabase(requested) {
		return routeResult{Tools: append([]string(nil), requested...)}
	}
	return routeResult{Tools: []string{}}
}

func draftIntent(text string) string {
	normalized := normalizeIntentText(text)
	if normalized == "" {
		return "none"
	}
	if containsPhrase(normalized, draftCancelPhrases) {
		return "cancel"
	}
	if containsPhrase(normalized, draftStartPhrases) {
		return "start"
	}
	return "none"
}

func classifyRepair(text string, requested []string) *routeResult {
	if !hasAll(requested, toolsByGroup("repair")) {
		return nil
	}
	normalized := normalizeIntentText(text)
	if !repairWordPattern.MatchString(normalized) {
		return nil
	}
	if draftIntent(text) == "start" {
		return &routeResult{Tools: append([]string(nil), requested...)}
	}
	request := repairRequestPattern.MatchString(normalized)
	workflow := repairWorkflowPattern.MatchString(normalized)
	status := equipmentStatusPattern.MatchString(normalized) || equipmentCountPattern.MatchString(normalized)
	if request || (workflow && !status) {
		return &routeResult{Tools: removeTool(requested, "equipmentLookup")}
	}
	if status {
		return &routeResult{Tools: removeTool(requested, "repairSummary")}
	}
	return &routeResult{Clarify: RepairClarification}
}

func classifyQuota(text string, requested []string) *routeResult {
	if !hasAll(requested, toolsByGroup("quota")) {
		return nil
	}
	normalized := normalizeIntentText(text)
	if !quotaWordPattern.MatchString(normalized) {
		return nil
	}
	specific := hasEquipmentIdentifier(text) || specificEquipmentPattern.MatchString(normalized)
	facility := facilitySummaryPattern.MatchString(normalized)
	if specific && !facility {
		return &routeResult{Tools: removeTool(requested, "quotaComplianceSummary")}
	}
	if facility && !specific {
		return &routeResult{Tools: removeTool(requested, "deviceQuotaLookup")}
	}
	return &routeResult{Clarify: QuotaClarification}
}

func classifyEquipment(text string, requested []string) *routeResult {
	if !containsTool(requested, "equipmentLookup") {
		return nil
	}
	normalized := normalizeIntentText(text)
	lookup := lookupIntentPattern.MatchString(normalized)
	equipment := equipmentWordPattern.MatchString(normalized)
	specific := hasSpecificEquipmentDescriptor(normalized)
	if !lookup || (!equipment && !specific) {
		return nil
	}
	if hasEquipmentIdentifier(text) || specific {
		if shouldNarrowEquipment(normalized, requested) {
			return &routeResult{Tools: keepOnly(requested, "equipmentLookup")}
		}
		return nil
	}
	return &routeResult{Clarify: EquipmentClarification}
}

func classifySQL(text string, requested []string) *routeResult {
	if !containsTool(requested, QueryToolName) || everyQueryDatabase(requested) {
		return nil
	}
	if hasEquipmentIdentifier(text) {
		return nil
	}
	normalized := normalizeIntentText(text)
	if !reportingIntentPattern.MatchString(normalized) || !reportingSubjectPattern.MatchString(normalized) || specificEquipmentPattern.MatchString(normalized) {
		return nil
	}
	return &routeResult{Tools: []string{QueryToolName}}
}

func shouldNarrowEquipment(normalized string, requested []string) bool {
	if !containsTool(requested, "equipmentLookup") || !lookupIntentPattern.MatchString(normalized) {
		return false
	}
	return !maintenancePattern.MatchString(normalized) &&
		!repairMentionPattern.MatchString(normalized) &&
		!usagePattern.MatchString(normalized) &&
		!attachmentPattern.MatchString(normalized) &&
		!quotaWordPattern.MatchString(normalized) &&
		!reportingIntentPattern.MatchString(normalized)
}

func holdBackQueryDatabase(requested []string) []string {
	if !containsTool(requested, QueryToolName) || everyQueryDatabase(requested) {
		return append([]string(nil), requested...)
	}
	return removeTool(requested, QueryToolName)
}

func everyQueryDatabase(requested []string) bool {
	if len(requested) == 0 {
		return true
	}
	for _, name := range requested {
		if name != QueryToolName {
			return false
		}
	}
	return true
}

func hasAll(requested, required []string) bool {
	for _, name := range required {
		if !containsTool(requested, name) {
			return false
		}
	}
	return true
}

func containsTool(requested []string, name string) bool {
	for _, candidate := range requested {
		if candidate == name {
			return true
		}
	}
	return false
}

func removeTool(requested []string, name string) []string {
	filtered := make([]string, 0, len(requested))
	for _, candidate := range requested {
		if candidate != name {
			filtered = append(filtered, candidate)
		}
	}
	return filtered
}

func keepOnly(requested []string, name string) []string {
	filtered := make([]string, 0, 1)
	for _, candidate := range requested {
		if candidate == name {
			filtered = append(filtered, candidate)
		}
	}
	return filtered
}

func latestUserText(messages []protocol.Message) string {
	for index := len(messages) - 1; index >= 0; index-- {
		if messages[index].Role != protocol.RoleUser {
			continue
		}
		text := strings.TrimSpace(messages[index].Content)
		if text != "" {
			return text
		}
	}
	return ""
}
