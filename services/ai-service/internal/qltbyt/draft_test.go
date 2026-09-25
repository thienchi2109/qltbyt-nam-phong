package qltbyt

import (
	"context"
	"encoding/json"
	"strings"
	"testing"
	"time"

	"example.com/shared-ai-service/internal/capability"
	"example.com/shared-ai-service/internal/orchestration"
	"example.com/shared-ai-service/internal/protocol"
	"example.com/shared-ai-service/internal/registry"
	"example.com/shared-ai-service/internal/testmodel"
	"example.com/shared-ai-service/internal/usage"
	"github.com/cloudwego/eino/schema"
)

func TestRepairDraftEmitsArtifactWithoutSubmit(t *testing.T) {
	extracts := 0
	modelStub := &testmodel.Scripted{GenerateFunc: func(_ context.Context, input []*schema.Message) (*schema.Message, error) {
		last := input[len(input)-1]
		if strings.Contains(last.Content, "Trích xuất dữ liệu bản nháp") {
			extracts++
			if strings.Contains(last.Content, "HISTSECRET") {
				t.Fatal("extraction prompt included uiArtifact")
			}
			return testmodel.UsageMessage(`{"mo_ta_su_co":"Thiết bị mất nguồn","hang_muc_sua_chua":"Kiểm tra bo nguồn","ngay_mong_muon_hoan_thanh":null,"don_vi_thuc_hien":"noi_bo","ten_don_vi_thue":"Công ty ABC","missingRequiredFields":["mo_ta_su_co"]}`, "stop", 1, 1), nil
		}
		if last.Role == schema.Tool {
			return testmodel.UsageMessage("Đã ghi nhận.", "stop", 3, 2), nil
		}
		message := testmodel.UsageMessage("", "tool_calls", 4, 1)
		message.ToolCalls = []schema.ToolCall{{ID: "call-1", Type: "function", Function: schema.FunctionCall{Name: "equipmentLookup", Arguments: `{}`}}}
		return message, nil
	}}
	broker := &spyBroker{body: []byte(`{"data":[{"thiet_bi_id":42,"ma_thiet_bi":"TB-042","ten_thiet_bi":"Máy thở ABC","secret":"HISTSECRET"}],"total":1}`)}
	assistant := testAssistant(broker, &spyQuery{})
	cred := testCredential("technician", facilityPtr(2), nil)
	request := testRequest(t, cred, "Tạo phiếu yêu cầu sửa chữa thiết bị", []string{"equipmentLookup", "repairSummary"})
	prepared, err := assistant.Prepare(context.Background(), request)
	if err != nil {
		t.Fatal(err)
	}
	for _, tool := range prepared.Tools {
		if tool.Name == ToolRepairRequestDraft || strings.Contains(strings.ToLower(tool.Name), "create") {
			t.Fatalf("model tool list included %s", tool.Name)
		}
	}
	prepared.Cleanup()
	reg := registry.New()
	if err := Register(reg, assistant); err != nil {
		t.Fatal(err)
	}
	runner := &orchestration.Runner{
		Registry: reg,
		Usage:    usage.NewMemory(func() time.Time { return fixedNow }),
		Open: func(context.Context, protocol.Request) (orchestration.ModelSession, error) {
			return localSession{chat: modelStub}, nil
		},
	}
	result, err := runner.Run(context.Background(), request)
	if err != nil {
		t.Fatal(err)
	}
	if _, ok := assistant.budgets.Load(request.RequestID); ok {
		t.Fatal("successful runner execution retained its budget slot")
	}
	if extracts != 1 {
		t.Fatalf("extraction calls = %d", extracts)
	}
	if result.Reconciliation.Attempts != 3 || result.Reconciliation.InputTokens == nil || *result.Reconciliation.InputTokens != 8 || *result.Reconciliation.OutputTokens != 4 {
		t.Fatalf("usage = %+v", result.Reconciliation)
	}
	var payload map[string]any
	sawArtifact := false
	for _, event := range result.Events {
		if event.Type == protocol.EventFinish && !sawArtifact {
			t.Fatal("finish arrived before the draft artifact")
		}
		if event.Type != protocol.EventArtifact {
			continue
		}
		sawArtifact = true
		if err := json.Unmarshal(event.Payload, &payload); err != nil {
			t.Fatal(err)
		}
	}
	if !sawArtifact || payload["kind"] != "repairRequestDraft" || payload["draftOnly"] != true || payload["source"] != "assistant" {
		t.Fatalf("artifact = %#v", payload)
	}
	form, _ := payload["formData"].(map[string]any)
	if form["mo_ta_su_co"] != "Thiết bị mất nguồn" || form["hang_muc_sua_chua"] != "Kiểm tra bo nguồn" || form["ten_don_vi_thue"] != nil {
		t.Fatalf("form = %#v", form)
	}
	missing, _ := payload["missingFields"].([]any)
	if len(missing) != 0 {
		t.Fatalf("missing fields = %#v", missing)
	}
	for _, call := range broker.snapshot() {
		lower := strings.ToLower(call.RPC)
		if strings.Contains(lower, "create") || strings.Contains(lower, "update") || strings.Contains(lower, "delete") || call.RPC == RPCQuotaReserve {
			t.Fatalf("draft submitted through %s", call.RPC)
		}
	}
}

func TestInactiveOrAmbiguousDraftDoesNotExtract(t *testing.T) {
	for _, test := range []struct {
		name  string
		text  string
		tools []string
		body  string
		calls int
	}{
		{name: "inactive", text: "xin chào", calls: 1},
		{name: "ambiguous", text: "Tạo phiếu sửa chữa", tools: []string{"equipmentLookup", "repairSummary"}, body: `{"data":[{"thiet_bi_id":1},{"thiet_bi_id":2}],"total":2}`, calls: 2},
	} {
		t.Run(test.name, func(t *testing.T) {
			extracts := 0
			modelStub := &testmodel.Scripted{GenerateFunc: func(_ context.Context, input []*schema.Message) (*schema.Message, error) {
				last := input[len(input)-1]
				if strings.Contains(last.Content, "Trích xuất dữ liệu bản nháp") {
					extracts++
					return testmodel.UsageMessage("{}", "stop", 1, 1), nil
				}
				if last.Role == schema.Tool || len(test.tools) == 0 {
					return testmodel.UsageMessage("ok", "stop", 1, 1), nil
				}
				message := testmodel.UsageMessage("", "tool_calls", 1, 1)
				message.ToolCalls = []schema.ToolCall{{ID: "call-1", Type: "function", Function: schema.FunctionCall{Name: "equipmentLookup", Arguments: `{}`}}}
				return message, nil
			}}
			body := []byte(`{"data":[],"total":0}`)
			if test.body != "" {
				body = []byte(test.body)
			}
			assistant := testAssistant(&spyBroker{body: body}, &spyQuery{})
			request := testRequest(t, testCredential("technician", facilityPtr(2), nil), test.text, test.tools)
			reg := registry.New()
			if err := Register(reg, assistant); err != nil {
				t.Fatal(err)
			}
			runner := &orchestration.Runner{
				Registry: reg,
				Usage:    usage.NewMemory(func() time.Time { return fixedNow }),
				Open: func(context.Context, protocol.Request) (orchestration.ModelSession, error) {
					return localSession{chat: modelStub}, nil
				},
			}
			result, err := runner.Run(context.Background(), request)
			if err != nil {
				t.Fatal(err)
			}
			if extracts != 0 || modelStub.CallCount() != test.calls {
				t.Fatalf("extracts=%d calls=%d", extracts, modelStub.CallCount())
			}
			for _, event := range result.Events {
				if event.Type == protocol.EventArtifact {
					t.Fatal("unexpected artifact")
				}
			}
		})
	}
}

func TestMissingAndInvalidExtractionEmitNoArtifact(t *testing.T) {
	assistant := testAssistant(&spyBroker{}, &spyQuery{})
	request := testRequest(t, testCredential("technician", facilityPtr(2), nil), "Tạo phiếu sửa chữa", nil)
	output := `{"followUpContext":{"equipment":[{"thiet_bi_id":42}]},"uiArtifact":{"rawPayload":{"secret":"HISTSECRET"}}}`
	follow := assistant.repairFollowUp(request, capability.PrimaryOutput{ToolResults: []capability.ToolResult{{Name: "equipmentLookup", Output: output}}})
	if len(follow.Extraction) != 1 || strings.Contains(follow.Extraction[0].Content, "HISTSECRET") {
		t.Fatalf("prompt = %#v", follow.Extraction)
	}
	for _, text := range []string{`{"mo_ta_su_co":null,"hang_muc_sua_chua":"Kiểm tra bo nguồn","missingRequiredFields":["mo_ta_su_co"]}`, "not-json", `{"mo_ta_su_co":"mất nguồn","hang_muc_sua_chua":"kiểm tra","don_vi_thuc_hien":"khac"}`} {
		artifacts, err := follow.MapExtraction(text)
		if err != nil || len(artifacts) != 0 {
			t.Fatalf("text %s artifacts=%d err=%v", text, len(artifacts), err)
		}
	}
}

func TestExtractionPromptDoesNotFitTheRemainingBudget(t *testing.T) {
	assistant := testAssistant(&spyBroker{}, &spyQuery{})
	request := testRequest(t, testCredential("technician", facilityPtr(2), nil), "Tạo phiếu sửa chữa", nil)
	assistant.budgetSlot(request.RequestID).used = CompactedInputLimit - 8
	follow := assistant.repairFollowUp(request, capability.PrimaryOutput{ToolResults: []capability.ToolResult{{
		Name: "equipmentLookup", Output: `{"followUpContext":{"equipment":[{"thiet_bi_id":7}]}}`,
	}}})
	if len(follow.Extraction) != 0 || follow.MapExtraction != nil {
		t.Fatal("extraction model would have been called")
	}
}
