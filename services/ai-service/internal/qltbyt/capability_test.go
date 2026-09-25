package qltbyt

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"testing"
	"time"

	"example.com/shared-ai-service/fixtures/secondapp"
	"example.com/shared-ai-service/internal/ingress"
	"example.com/shared-ai-service/internal/orchestration"
	"example.com/shared-ai-service/internal/protocol"
	"example.com/shared-ai-service/internal/registry"
	"example.com/shared-ai-service/internal/testmodel"
	"example.com/shared-ai-service/internal/usage"
	"github.com/cloudwego/eino/schema"
	"net/http"
)

func TestClarificationSkipsReserveOpenAndBudget(t *testing.T) {
	assistant := testAssistant(&spyBroker{}, &spyQuery{})
	reg := registry.New()
	if err := Register(reg, assistant); err != nil {
		t.Fatal(err)
	}
	opens := 0
	runner := &orchestration.Runner{
		Registry: reg,
		Usage:    usage.NewMemory(func() time.Time { return fixedNow }),
		Open: func(context.Context, protocol.Request) (orchestration.ModelSession, error) {
			opens++
			return localSession{chat: localModel{}}, nil
		},
	}
	text := "Có bao nhiêu phiếu sửa chữa và thiết bị vượt định mức trong đơn vị hiện tại?" + strings.Repeat(" zzz", 20000)
	if len(text) <= CompactedInputLimit {
		t.Fatal("fixture is not over the compacted budget")
	}
	request := testRequest(t, testCredential("technician", facilityPtr(2), nil), text, []string{
		"equipmentLookup", "repairSummary", "deviceQuotaLookup", "quotaComplianceSummary", "query_database",
	})
	result, err := runner.Run(context.Background(), request)
	if err != nil {
		t.Fatal(err)
	}
	if result.Reserved || opens != 0 {
		t.Fatalf("reserved %v opens %d", result.Reserved, opens)
	}
	var seen string
	for _, event := range result.Events {
		if event.Type == protocol.EventText {
			seen = event.Text
		}
	}
	if seen != MixedClarification {
		t.Fatalf("clarification = %q", seen)
	}
}

func TestFacilityClarificationPrecedesCompactionBudget(t *testing.T) {
	assistant := testAssistant(&spyBroker{}, &spyQuery{})
	text := "yêu cầu sửa chữa đang tồn đọng" + strings.Repeat(" z", 30000)
	if len(text) <= CompactedInputLimit {
		t.Fatal("fixture is not over the compacted budget")
	}
	prepared, err := assistant.Prepare(context.Background(), testRequest(t, testCredential("admin", nil, nil), text, []string{"equipmentLookup", "repairSummary"}))
	if err != nil {
		t.Fatal(err)
	}
	if prepared.Clarification != FacilityRequiredMessage {
		t.Fatalf("clarification = %q", prepared.Clarification)
	}
}

func TestCompactionBudgetMeasuresHistoryAfterArtifactStrip(t *testing.T) {
	assistant := testAssistant(&spyBroker{}, &spyQuery{})
	request := testRequest(t, testCredential("technician", facilityPtr(2), nil), "Xin chào", []string{"equipmentLookup"})
	request.Messages = append(request.Messages, protocol.Message{
		Role:    protocol.RoleTool,
		Content: `{"modelSummary":{"summaryText":"equipmentLookup: 1 result(s)."},"uiArtifact":{"rawPayload":{"blob":"` + strings.Repeat("H", 50000) + `"}}}`,
	})
	if messageBytes(request.Messages) <= CompactedInputLimit {
		t.Fatal("raw history is not over the budget")
	}
	prepared, err := assistant.Prepare(context.Background(), request)
	if err != nil {
		t.Fatal(err)
	}
	if messageBytes(prepared.Messages) == 0 || strings.Contains(prepared.Messages[len(prepared.Messages)-1].Content, "HHHH") {
		t.Fatalf("history = %#v", prepared.Messages)
	}
}

func TestProceedingRequestHitsCompactionBudgetBeforeReserve(t *testing.T) {
	assistant := testAssistant(&spyBroker{}, &spyQuery{})
	reg := registry.New()
	if err := Register(reg, assistant); err != nil {
		t.Fatal(err)
	}
	opens := 0
	runner := &orchestration.Runner{
		Registry: reg,
		Usage:    usage.NewMemory(func() time.Time { return fixedNow }),
		Open: func(context.Context, protocol.Request) (orchestration.ModelSession, error) {
			opens++
			return localSession{chat: localModel{}}, nil
		},
	}
	request := testRequest(t, testCredential("technician", facilityPtr(2), nil), "Xin chào, bạn giúp được gì?"+strings.Repeat(" zzz", 20000), []string{"equipmentLookup", "query_database"})
	_, err := runner.Run(context.Background(), request)
	var serviceErr *protocol.Error
	if !errors.As(err, &serviceErr) || serviceErr.Code != protocol.CodeLimitExceeded || opens != 0 {
		t.Fatalf("err = %v opens %d", err, opens)
	}
}

func TestUnknownAndBlockedToolsFailBeforeExecution(t *testing.T) {
	for _, name := range []string{"systemDiagnostics", "queryDatabase", "deleteEquipment"} {
		t.Run(name, func(t *testing.T) {
			assistant := testAssistant(&spyBroker{}, &spyQuery{})
			_, err := assistant.Prepare(context.Background(), testRequest(t, testCredential("technician", facilityPtr(2), nil), "Xin chào", []string{name}))
			var serviceErr *protocol.Error
			if !errors.As(err, &serviceErr) || serviceErr.Status != 400 {
				t.Fatalf("err = %#v", err)
			}
			if name == "systemDiagnostics" && !strings.Contains(serviceErr.Message, "systemDiagnostics") {
				t.Fatal(serviceErr.Message)
			}
		})
	}
}

func TestDraftToolsAreNotModelExecuted(t *testing.T) {
	if err := rejectAutonomousDraft(ToolRepairRequestDraft); err == nil {
		t.Fatal("repair draft was executable")
	}
	if err := rejectAutonomousDraft(ToolTroubleshootingDraft); err == nil {
		t.Fatal("troubleshooting draft was executable")
	}
	assistant := testAssistant(&spyBroker{}, &spyQuery{})
	prepared, err := assistant.Prepare(context.Background(), testRequest(t, testCredential("technician", facilityPtr(2), nil), "Tạo phiếu yêu cầu sửa chữa thiết bị", []string{"equipmentLookup", "repairSummary", ToolRepairRequestDraft, ToolTroubleshootingDraft}))
	if err != nil {
		t.Fatal(err)
	}
	for _, tool := range prepared.Tools {
		if tool.Name == ToolRepairRequestDraft || tool.Name == ToolTroubleshootingDraft {
			t.Fatalf("model can call %s", tool.Name)
		}
	}
	descriptor := assistant.Descriptor()
	if strings.Join(descriptor.ArtifactSchemas, ",") != TroubleshootingDraftKind+","+RepairRequestDraftKind {
		t.Fatalf("schemas = %#v", descriptor.ArtifactSchemas)
	}
}

func TestPromptUsesScopeNotTenantOrDisplayAuthority(t *testing.T) {
	assistant := testAssistant(&spyBroker{}, &spyQuery{})
	prepared, err := assistant.Prepare(context.Background(), testRequest(t, testCredential("technician", facilityPtr(2), facilityPtr(9)), "yêu cầu sửa chữa đang tồn đọng", []string{"equipmentLookup", "repairSummary"}))
	if err != nil {
		t.Fatal(err)
	}
	if len(prepared.Messages) == 0 || prepared.Messages[0].Role != protocol.RoleSystem {
		t.Fatal("missing system prompt")
	}
	prompt := prepared.Messages[0].Content
	if !strings.Contains(prompt, "System prompt version: "+PromptVersion) || !strings.Contains(prompt, "ID: 2") || !strings.Contains(prompt, "Untrusted Display") {
		t.Fatal("prompt missing scope display")
	}
	if strings.Contains(prompt, "ID: 999") || strings.Contains(prompt, "ID: 9") || strings.Contains(prompt, "KHÔNG tự từ chối") {
		t.Fatal("prompt treated tenant, requested facility, or privilege incorrectly")
	}
	if !strings.Contains(prompt, QueryDatabasePromptPointer) || !strings.Contains(prompt, "KHÔNG BAO GIỜ tự động tạo hoặc gửi yêu cầu sửa chữa") {
		t.Fatal("prompt dropped query or draft rules")
	}
	privileged := buildSystemPrompt(promptInput{Role: "admin", FacilityID: 11, FacilityName: "Untrusted Display", PrivilegedRole: true})
	if !strings.Contains(privileged, "ID: 11") || !strings.Contains(privileged, "KHÔNG tự từ chối") {
		t.Fatal("privileged prompt missing facility guidance")
	}
	unspecified := buildSystemPrompt(promptInput{Role: "user", FacilityName: "Untrusted Display"})
	if strings.Contains(unspecified, "Untrusted Display") || !strings.Contains(unspecified, "unspecified") {
		t.Fatal("display name was treated as a facility")
	}
}

func TestCompactionUsesCatalogBudgets(t *testing.T) {
	var builder strings.Builder
	builder.WriteString(`{"data":[`)
	for index := 0; index < 60; index++ {
		if index > 0 {
			builder.WriteByte(',')
		}
		fmt.Fprintf(&builder, `{"name":"Khoa %d","equipment_count":1,"secret_field":"SECRETROW"}`, index)
	}
	builder.WriteString(`],"total":60}`)
	encoded, err := compactModelOutput(catalogMust("departmentList"), json.RawMessage(builder.String()))
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(string(encoded), "SECRETROW") || strings.Contains(string(encoded), "uiArtifact") {
		t.Fatalf("model output kept hidden fields: %s", encoded)
	}
	var parsed struct {
		ModelSummary struct {
			ItemCount       int `json:"itemCount"`
			ImportantFields struct {
				Departments []struct {
					Name string `json:"name"`
				} `json:"departments"`
			} `json:"importantFields"`
			Truncated bool `json:"truncated"`
		} `json:"modelSummary"`
	}
	if err := json.Unmarshal(encoded, &parsed); err != nil {
		t.Fatal(err)
	}
	if !parsed.ModelSummary.Truncated || len(parsed.ModelSummary.ImportantFields.Departments) != 50 || parsed.ModelSummary.ItemCount != 60 {
		t.Fatalf("budget = %+v", parsed.ModelSummary)
	}
}

func TestSecondAppCannotSeeHostTools(t *testing.T) {
	hostBroker := &spyBroker{}
	reg := registry.New()
	if err := reg.Register(secondapp.Capability{}); err != nil {
		t.Fatal(err)
	}
	if err := Register(reg, testAssistant(hostBroker, &spyQuery{})); err != nil {
		t.Fatal(err)
	}
	item, err := reg.Lookup(secondapp.AppID, secondapp.CapabilityID, secondapp.Version)
	if err != nil {
		t.Fatal(err)
	}
	prepared, err := item.Prepare(context.Background(), protocol.Request{
		Messages: []protocol.Message{{Role: protocol.RoleUser, Content: "lookup"}},
	})
	if err != nil {
		t.Fatal(err)
	}
	for _, tool := range prepared.Tools {
		if tool.Name != secondapp.ToolName {
			t.Fatalf("second app saw %s", tool.Name)
		}
	}
	opens := 0
	runner := &orchestration.Runner{
		Registry: reg,
		Usage:    usage.NewMemory(func() time.Time { return fixedNow }),
		Open: func(context.Context, protocol.Request) (orchestration.ModelSession, error) {
			opens++
			return localSession{chat: &testmodel.Scripted{GenerateFunc: func(context.Context, []*schema.Message) (*schema.Message, error) {
				return testmodel.UsageMessage("ok", "stop", 1, 1), nil
			}}}, nil
		},
	}
	request := protocol.Request{
		ProtocolVersion: protocol.ProtocolVersion, AppID: secondapp.AppID, CapabilityID: secondapp.CapabilityID,
		CapabilityVersion: secondapp.Version, RequestID: "second-app-phase2",
		Messages: []protocol.Message{{Role: protocol.RoleUser, Content: "lookup"}}, RequestedTools: []string{"equipmentLookup"},
	}
	if _, err := runner.Run(context.Background(), request); err == nil {
		t.Fatal("second app executed a host tool")
	}
	if opens != 0 || len(hostBroker.snapshot()) != 0 {
		t.Fatalf("opens %d broker %d", opens, len(hostBroker.snapshot()))
	}
}

func TestIngressBindingRejectsForeignApp(t *testing.T) {
	secret := []byte("binding-secret")
	guard := ingress.NewReplayGuard(fixedNow, []ingress.Key{{
		ID: "key-1", Secret: secret, Issuer: "nextjs-bff", Audience: "ai-service-v1", AppID: AppID, CapabilityID: CapabilityID,
	}})
	now := fixedNow.Add(ingress.Quarantine)
	foreign := signedBindingBody("other-app", "req-foreign")
	header := bindingHeader(secret, "req-foreign", strconvUnix(now), foreign)
	if _, err := guard.Authenticate(now, header, foreign); err == nil {
		t.Fatal("foreign app was accepted")
	}
	native := signedBindingBody(AppID, "req-native")
	nativeHeader := bindingHeader(secret, "req-native", strconvUnix(now), native)
	if _, err := guard.Authenticate(now, nativeHeader, native); err != nil {
		t.Fatal(err)
	}
}

func signedBindingBody(appID, requestID string) []byte {
	return []byte(`{"protocol_version":"v1","app_id":"` + appID + `","capability_id":"` + CapabilityID + `","capability_version":"v1","request_id":"` + requestID + `","identity":{"issuer":"nextjs-bff","audience":"ai-service-v1"},"messages":[{"role":"user","content":"hello"}]}`)
}

func bindingHeader(secret []byte, requestID, timestamp string, body []byte) http.Header {
	header := make(http.Header)
	header.Set(ingress.HeaderTimestamp, timestamp)
	header.Set(ingress.HeaderRequestID, requestID)
	header.Set(ingress.HeaderKeyID, "key-1")
	header.Set(ingress.HeaderSignature, ingress.Sign(secret, timestamp, requestID, "key-1", body))
	return header
}

func strconvUnix(value time.Time) string {
	return fmt.Sprintf("%d", value.Unix())
}
