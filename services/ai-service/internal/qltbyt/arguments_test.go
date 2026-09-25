package qltbyt

import (
	"context"
	"errors"
	"strings"
	"testing"

	"example.com/shared-ai-service/internal/protocol"
	"github.com/cloudwego/eino/schema"
)

func TestNullCatalogArgumentsDoNotPanic(t *testing.T) {
	names := []string{
		"equipmentLookup", "maintenanceSummary", "maintenancePlanLookup", "repairSummary",
		"usageHistory", "attachmentLookup", "deviceQuotaLookup", "quotaComplianceSummary",
		"categorySuggestion", "departmentList",
	}
	broker := &spyBroker{}
	assistant := testAssistant(broker, &spyQuery{})
	cred := testCredential("technician", facilityPtr(2), nil)
	scope := resolvedScope(t, "technician", 2)
	for _, name := range names {
		t.Run(name, func(t *testing.T) {
			_, err := assistant.runCatalog(context.Background(), cred, scope, "req-null", catalogMust(name), "null")
			var serviceErr *protocol.Error
			if !errors.As(err, &serviceErr) || serviceErr.Code != protocol.CodeInvalidRequest {
				t.Fatalf("err = %v", err)
			}
		})
	}
	if _, err := assistant.runCatalog(context.Background(), cred, scope, "req-missing", catalogMust("categorySuggestion"), `{}`); err == nil {
		t.Fatal("missing device_name was accepted")
	}
	if len(broker.snapshot()) != 0 {
		t.Fatal("invalid arguments reached the broker")
	}
}

func TestToolArgumentsRejectUnknownFieldsAndPublishSchema(t *testing.T) {
	broker := &spyBroker{}
	assistant := testAssistant(broker, &spyQuery{})
	cred := testCredential("technician", facilityPtr(2), nil)
	scope := resolvedScope(t, "technician", 2)
	_, err := assistant.runCatalog(context.Background(), cred, scope, "req-extra", catalogMust("equipmentLookup"), `{"query":"monitor","filters":{"equipmentCode":"TB-1","secret":"no"}}`)
	if err == nil || len(broker.snapshot()) != 0 {
		t.Fatalf("err = %v calls = %+v", err, broker.snapshot())
	}
	raw, err := assistant.runCatalog(context.Background(), cred, scope, "req-ok", catalogMust("equipmentLookup"), `{"query":" monitor ","limit":10,"filters":{"status":"hong"}}`)
	if err != nil {
		t.Fatal(err)
	}
	calls := broker.snapshot()
	if len(calls) != 1 || !strings.Contains(calls[0].Payload, `"query":"monitor"`) || !strings.Contains(calls[0].Payload, `"status":"hong"`) || !strings.Contains(calls[0].Payload, `"p_user_id":"42"`) || strings.Contains(calls[0].Payload, "secret") {
		t.Fatalf("payload = %s result %s", calls[0].Payload, raw)
	}
	tools := assistant.bindTools(cred, scope, "req-schema", []string{"equipmentLookup", "maintenancePlanLookup", QueryToolName, "departmentList"})
	byName := map[string]map[string]*schema.ParameterInfo{}
	for _, tool := range tools {
		byName[tool.Name] = tool.Parameters
	}
	if byName["equipmentLookup"]["filters"] == nil || byName["equipmentLookup"]["filters"].SubParams["equipmentCode"] == nil {
		t.Fatal("equipment filters are not in the model schema")
	}
	if byName["maintenancePlanLookup"]["p_thiet_bi_id"] == nil || !byName["maintenancePlanLookup"]["p_thiet_bi_id"].Required {
		t.Fatal("equipment id is not required in the model schema")
	}
	if byName[QueryToolName]["sql"] == nil || !byName[QueryToolName]["sql"].Required || byName[QueryToolName]["reasoning"] == nil {
		t.Fatal("query_database schema is missing sql or reasoning")
	}
	if len(byName["departmentList"]) != 0 {
		t.Fatal("departmentList published unexpected arguments")
	}
	params := schema.NewParamsOneOfByParams(byName[QueryToolName])
	encoded, err := params.ToJSONSchema()
	if err != nil || encoded == nil || encoded.Properties == nil {
		t.Fatalf("schema = %#v err %v", encoded, err)
	}
	if _, ok := encoded.Properties.Get("sql"); !ok {
		t.Fatal("model schema omitted sql")
	}
	if _, ok := encoded.Properties.Get("reasoning"); !ok {
		t.Fatal("model schema omitted reasoning")
	}
	executor := &spyQuery{}
	queryAssistant := testAssistant(&spyBroker{}, executor)
	queryTools := queryAssistant.bindTools(cred, scope, "req-sql", []string{QueryToolName})
	if _, err := queryTools[0].Run(context.Background(), `{"sql":"select 1 from ai_readonly.equipment_search"}`); err == nil || executor.count() != 0 {
		t.Fatal("query arguments without reasoning reached the executor")
	}
	if _, err := queryTools[0].Run(context.Background(), `{"sql":"select 1 from ai_readonly.equipment_search","reasoning":"count","extra":true}`); err == nil || executor.count() != 0 {
		t.Fatal("unknown query field reached the executor")
	}
}
