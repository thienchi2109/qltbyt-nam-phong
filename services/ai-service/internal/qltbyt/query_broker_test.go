package qltbyt

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"testing"
	"time"

	"example.com/shared-ai-service/internal/protocol"
)

func TestQueryDisabledWithoutExecutorOrAudit(t *testing.T) {
	executor := &spyQuery{}
	withoutExecutor := testAssistant(&spyBroker{}, nil)
	if withoutExecutor.queryEnabled() {
		t.Fatal("query enabled without executor")
	}
	if _, err := withoutExecutor.executeQuery(context.Background(), testCredential("technician", facilityPtr(2), nil), resolvedScope(t, "technician", 2), 2, "select 1 from ai_readonly.equipment_search", "req"); err == nil || executor.count() != 0 {
		t.Fatal("missing executor still executed")
	}
	withoutAudit := testAssistant(nil, executor)
	prepared, err := withoutAudit.Prepare(context.Background(), testRequest(t, testCredential("technician", facilityPtr(2), nil), "Xin chào", []string{"query_database"}))
	if err != nil {
		t.Fatal(err)
	}
	for _, tool := range prepared.Tools {
		if tool.Name == QueryToolName {
			t.Fatal("query_database was offered without an audit broker")
		}
	}
	if _, err := withoutAudit.executeQuery(context.Background(), testCredential("technician", facilityPtr(2), nil), resolvedScope(t, "technician", 2), 2, "select 1 from ai_readonly.equipment_search", "req"); err == nil || executor.count() != 0 {
		t.Fatal("missing audit path reached the executor")
	}
}

func TestUnsafeSQLDoesNotReachExecutor(t *testing.T) {
	broker := &spyBroker{}
	executor := &spyQuery{}
	log := &captureLog{}
	assistant := testAssistant(broker, executor)
	assistant.Log = log
	sql := "with x as (delete from ai_readonly.equipment_search returning *) select * from x"
	scope := resolvedScope(t, "technician", 2)
	_, err := assistant.executeQuery(context.Background(), testCredential("technician", facilityPtr(2), nil), scope, scope.EffectiveFacilityID, sql, "req-unsafe")
	var sqlErr *SQLError
	if !errors.As(err, &sqlErr) || sqlErr.Code != "forbidden_keyword" {
		t.Fatalf("err = %v", err)
	}
	if executor.count() != 0 {
		t.Fatal("unsafe SQL reached the executor")
	}
	calls := broker.snapshot()
	if len(calls) != 1 || calls[0].RPC != RPCAudit || calls[0].UserID != 42 {
		t.Fatalf("audit = %+v", calls)
	}
	var payload struct {
		Shape  string `json:"p_sql_shape"`
		Tool   string `json:"p_tool_path"`
		Status string `json:"p_status"`
		Class  string `json:"p_error_class"`
	}
	if err := json.Unmarshal([]byte(calls[0].Payload), &payload); err != nil {
		t.Fatal(err)
	}
	sum := sha256.Sum256([]byte(sql))
	if payload.Shape == "" || payload.Shape == hex.EncodeToString(sum[:]) || !strings.Contains(payload.Shape, "delete") {
		t.Fatalf("shape = %q", payload.Shape)
	}
	if payload.Tool != QueryToolName || payload.Status != "failure" || payload.Class == "" {
		t.Fatalf("payload = %+v", payload)
	}
	if strings.Contains(log.text(), "delete") || strings.Contains(log.text(), sql) {
		t.Fatalf("log leaked SQL: %s", log.text())
	}
}

func TestSuccessfulQueryAuditsBeforeRelease(t *testing.T) {
	broker := &spyBroker{}
	executor := &spyQuery{result: QueryResult{Rows: []byte(`[{"equipment_id":1}]`), RowCount: 1, PayloadBytes: 20}}
	assistant := testAssistant(broker, executor)
	scope := resolvedScope(t, "technician", 4)
	rows, err := assistant.executeQuery(context.Background(), testCredential("technician", facilityPtr(4), nil), scope, scope.EffectiveFacilityID, "select equipment_id from ai_readonly.equipment_search", "req-ok")
	if err != nil || string(rows) != `[{"equipment_id":1}]` || executor.count() != 1 {
		t.Fatalf("rows %s err %v calls %d", rows, err, executor.count())
	}
	queryCall := executor.calls[0]
	if queryCall.SearchPath != QuerySearchPath || queryCall.Timeout != QueryTimeout || queryCall.MaxRows != QueryMaxRows || queryCall.MaxPayloadBytes != QueryMaxPayload || queryCall.FacilityID != 4 || queryCall.UserID != 42 {
		t.Fatalf("query call = %+v", queryCall)
	}
	settings := SessionSettings(queryCall)
	joined := fmt.Sprint(settings)
	if !strings.Contains(joined, "5000ms") || !strings.Contains(joined, QuerySearchPath) || !strings.Contains(joined, "app.current_facility_id") || !strings.Contains(LimitedStatement(queryCall.Statement, queryCall.MaxRows), "limit 101") {
		t.Fatalf("settings = %s", joined)
	}
	calls := broker.snapshot()
	if len(calls) != 1 || calls[0].RPC != RPCAudit || calls[0].UserID != 42 || !strings.Contains(calls[0].Payload, `"p_status":"success"`) || !strings.Contains(calls[0].Payload, `"p_row_count":1`) || !strings.Contains(calls[0].Payload, `"p_facility_source":"session"`) || !strings.Contains(calls[0].Payload, `"p_tool_path":"query_database"`) {
		t.Fatalf("audit = %+v", calls)
	}
}

func TestFailureAuditPreservesOriginalError(t *testing.T) {
	original := errors.New("marker-EXEC")
	broker := &spyBroker{fail: map[string]error{RPCAudit: errors.New("audit down")}}
	executor := &spyQuery{err: original}
	assistant := testAssistant(broker, executor)
	scope := resolvedScope(t, "technician", 2)
	_, err := assistant.executeQuery(context.Background(), testCredential("technician", facilityPtr(2), nil), scope, scope.EffectiveFacilityID, "select equipment_id from ai_readonly.equipment_search", "req-fail")
	var sqlErr *SQLError
	if !errors.As(err, &sqlErr) || sqlErr.Code != "execution_error" || strings.Contains(err.Error(), "marker-EXEC") || errors.Is(err, original) {
		t.Fatalf("err = %v", err)
	}
	if executor.count() != 1 || len(broker.snapshot()) != 1 {
		t.Fatal("failure audit was not attempted")
	}
}

func TestSuccessAuditFailureDoesNotReleaseRows(t *testing.T) {
	broker := &spyBroker{fail: map[string]error{RPCAudit: errors.New("audit down")}}
	executor := &spyQuery{result: QueryResult{Rows: []byte(`[{"secret":"ROWSECRET"}]`), RowCount: 1, PayloadBytes: 24}}
	log := &captureLog{}
	assistant := testAssistant(broker, executor)
	assistant.Log = log
	scope := resolvedScope(t, "technician", 2)
	rows, err := assistant.executeQuery(context.Background(), testCredential("technician", facilityPtr(2), nil), scope, scope.EffectiveFacilityID, "select equipment_id from ai_readonly.equipment_search", "req-success")
	var sqlErr *SQLError
	if !errors.As(err, &sqlErr) || sqlErr.Code != "audit_error" || strings.Contains(string(rows), "ROWSECRET") {
		t.Fatalf("rows %s err %v", rows, err)
	}
	if strings.Contains(log.text(), "ROWSECRET") || strings.Contains(log.text(), "select equipment_id") {
		t.Fatalf("log = %s", log.text())
	}
}

func TestCredentialRejectionsHappenBeforeExecutor(t *testing.T) {
	executor := &spyQuery{}
	now := fixedNow
	base := testCredential("technician", facilityPtr(2), nil)
	token := mustToken(t, base)
	cases := []struct {
		name   string
		secret []byte
		token  string
		now    time.Time
	}{
		{name: "missing secret", secret: nil, token: token, now: now},
		{name: "expired", secret: testSecret(), token: mustToken(t, expired(base)), now: now.Add(2 * time.Minute)},
		{name: "wrong audience", secret: testSecret(), token: mustMint(t, base, func(payload *credentialPayload) { payload.Audience = "browser" }), now: now},
		{name: "forged", secret: testSecret(), token: token + "tamper", now: now},
		{name: "browser cookie", secret: testSecret(), token: mustBrowser(t, base), now: now},
	}
	for _, test := range cases {
		t.Run(test.name, func(t *testing.T) {
			assistant := Assistant{Broker: &spyBroker{}, Secret: test.secret, Query: executor, Now: func() time.Time { return test.now }}
			request := testRequest(t, base, "select", []string{"query_database"})
			request.Identity.CapabilityClaims["broker_token"] = test.token
			if err := assistant.Authorize(context.Background(), request); err == nil {
				t.Fatal("accepted unsafe credential")
			}
		})
	}
	if executor.count() != 0 {
		t.Fatal("executor ran during credential rejection")
	}
	scope := resolvedScope(t, "technician", 2)
	assistant := testAssistant(&spyBroker{}, executor)
	if _, err := assistant.executeQuery(context.Background(), base, scope, 9, "select 1 from ai_readonly.equipment_search", "req-scope"); err == nil || executor.count() != 0 {
		t.Fatal("wrong facility reached the executor")
	}
}

func TestCancellationDoesNotStartFurtherWorkOrWidenCleanup(t *testing.T) {
	started := make(chan struct{})
	executor := &spyQuery{start: started, wait: true}
	broker := &spyBroker{}
	assistant := testAssistant(broker, executor)
	scope := resolvedScope(t, "technician", 2)
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan error, 1)
	go func() {
		_, err := assistant.executeQuery(ctx, testCredential("technician", facilityPtr(2), nil), scope, scope.EffectiveFacilityID, "select equipment_id from ai_readonly.equipment_search", "req-cancel")
		done <- err
	}()
	select {
	case <-started:
	case <-time.After(time.Second):
		t.Fatal("query did not start")
	}
	cancel()
	if err := <-done; !errors.Is(err, context.Canceled) {
		t.Fatalf("err = %v", err)
	}
	if executor.count() != 0 || len(broker.snapshot()) != 0 {
		t.Fatal("cancellation started audit or a second execution")
	}
	cred := testCredential("admin", nil, facilityPtr(7))
	parent, parentCancel := context.WithCancel(context.Background())
	parentCancel()
	cleanupBroker := &spyBroker{}
	cleanup := testAssistant(cleanupBroker, executor)
	cleanup.Cleanup = 30 * time.Millisecond
	if _, err := cleanup.gate().Cleanup(parent, cred, "ai_equipment_lookup", nil); err == nil || len(cleanupBroker.snapshot()) != 0 {
		t.Fatal("cleanup called a catalog RPC")
	}
	if _, err := cleanup.gate().Cleanup(parent, cred, RPCQuotaFinalize, nil); err == nil {
		t.Fatal("cleanup called quota finalize")
	}
	widened, _ := json.Marshal(map[string]int64{"p_user_id": 999, "p_effective_facility_id": 8})
	if _, err := cleanup.gate().Cleanup(parent, cred, RPCAudit, widened); err == nil || len(cleanupBroker.snapshot()) != 0 {
		t.Fatal("cleanup widened user or facility")
	}
	auditPayload, _ := json.Marshal(auditBody{
		SQLShape: "select 1", ToolPath: QueryToolName, Status: "failure", LatencyMS: 1,
		Effective: 7, FacilitySource: facilitySourceSelected, ErrorClass: "execution_error",
	})
	waiter := &spyBroker{wait: true, start: make(chan struct{})}
	timed := testAssistant(waiter, nil)
	timed.Cleanup = 20 * time.Millisecond
	errCh := make(chan error, 1)
	go func() {
		_, err := timed.gate().Cleanup(parent, cred, RPCAudit, auditPayload)
		errCh <- err
	}()
	select {
	case <-waiter.start:
	case <-time.After(time.Second):
		t.Fatal("cleanup did not start")
	}
	select {
	case err := <-errCh:
		if !errors.Is(err, context.DeadlineExceeded) {
			t.Fatalf("cleanup err = %v", err)
		}
	case <-time.After(time.Second):
		t.Fatal("cleanup exceeded its bounded budget")
	}
}

func TestCurrentTurnKeepsEvidenceAndHistoryStripsIt(t *testing.T) {
	quotaBody := []byte(`{"status":"over","quota":3,"device":"Ventilator","decision":"keep"}`)
	broker := &spyBroker{body: quotaBody}
	assistant := testAssistant(broker, &spyQuery{})
	cred := testCredential("technician", facilityPtr(2), nil)
	scope := resolveScope(cred, true)
	quota, err := assistant.runCatalog(context.Background(), cred, scope, "req-quota", catalogMust("deviceQuotaLookup"), `{"p_thiet_bi_id":7}`)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(quota, `"uiArtifact"`) || !strings.Contains(quota, `"status":"over"`) || !strings.Contains(quota, `"quota":3`) {
		t.Fatalf("quota evidence = %s", quota)
	}
	if strings.Contains(quota, `"itemCount":0`) || !strings.Contains(quota, "completed") {
		t.Fatalf("quota summary = %s", quota)
	}

	lookupBody := []byte(`{"data":[{"thiet_bi_id":7,"ma_thiet_bi":"TB-7","ten_thiet_bi":"Monitor","tinh_trang_hien_tai":"hong"}],"total":1}`)
	lookupBroker := &spyBroker{body: lookupBody}
	lookup := testAssistant(lookupBroker, &spyQuery{})
	listed, err := lookup.runCatalog(context.Background(), cred, scope, "req-eq", catalogMust("equipmentLookup"), `{}`)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(listed, `"uiArtifact"`) || !strings.Contains(listed, `"tinh_trang_hien_tai":"hong"`) || !strings.Contains(listed, `"thiet_bi_id":7`) {
		t.Fatalf("lookup evidence = %s", listed)
	}

	request := testRequest(t, cred, "Xin chào", []string{"equipmentLookup"})
	request.Messages = append(request.Messages, protocol.Message{
		Role:    protocol.RoleTool,
		Content: `{"modelSummary":{"summaryText":"equipmentLookup: 1 result(s)."},"uiArtifact":{"rawPayload":{"secret":"HISTSECRET"}}}`,
	})
	prepared, err := assistant.Prepare(context.Background(), request)
	if err != nil {
		t.Fatal(err)
	}
	var toolContent string
	for _, message := range prepared.Messages {
		if message.Role == protocol.RoleTool {
			toolContent = message.Content
		}
	}
	if strings.Contains(toolContent, "HISTSECRET") || strings.Contains(toolContent, "uiArtifact") {
		t.Fatalf("history kept uiArtifact: %s", toolContent)
	}
	if !strings.Contains(toolContent, "equipmentLookup: 1 result(s).") {
		t.Fatalf("history dropped the summary: %s", toolContent)
	}
}

func TestQueryDatabaseEnvelopeKeepsRowsAndChart(t *testing.T) {
	rows := []byte(`[{"khoa_phong_quan_ly":"Khoa A","so_luong":2}]`)
	executor := &spyQuery{result: QueryResult{Rows: rows, RowCount: 1, PayloadBytes: len(rows)}}
	assistant := testAssistant(&spyBroker{}, executor)
	cred := testCredential("technician", facilityPtr(2), nil)
	scope := resolveScope(cred, true)
	tools := assistant.bindTools(cred, scope, "req-sql", []string{QueryToolName})
	if len(tools) != 1 || tools[0].Run == nil {
		t.Fatal("query tool was not bound")
	}
	out, err := tools[0].Run(context.Background(), `{"reasoning":"group by department","sql":"select khoa_phong_quan_ly, so_luong from ai_readonly.equipment_search"}`)
	if err != nil {
		t.Fatal(err)
	}
	for _, needle := range []string{`"uiArtifact"`, `"reportChart"`, `"khoa_phong_quan_ly"`, `"query_database: 1 row(s)."`, `"followUpContext"`} {
		if !strings.Contains(out, needle) {
			t.Fatalf("missing %s in %s", needle, out)
		}
	}
	if strings.Contains(out, "select khoa_phong") {
		t.Fatalf("envelope leaked SQL: %s", out)
	}
}

func TestChatPathDoesNotCallQuotaRPCs(t *testing.T) {
	if !knownRPC(RPCQuotaReserve) || !knownRPC(RPCQuotaFinalize) {
		t.Fatal("quota RPC names are not known")
	}
	broker := &spyBroker{}
	assistant := testAssistant(broker, &spyQuery{})
	cred := testCredential("technician", facilityPtr(2), facilityPtr(9))
	scope := resolveScope(cred, true)
	if scope.EffectiveFacilityID != 2 || scope.FacilitySource != facilitySourceSession {
		t.Fatalf("scope = %+v", scope)
	}
	raw, err := assistant.runCatalog(context.Background(), cred, scope, "req-dept", catalogMust("departmentList"), `{}`)
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(raw, "999") {
		t.Fatalf("payload echoed the client facility: %s", raw)
	}
	calls := broker.snapshot()
	if len(calls) != 1 || calls[0].RPC != "ai_department_list" || calls[0].UserID != 42 {
		t.Fatalf("calls = %+v", calls)
	}
	if !strings.Contains(calls[0].Payload, `"p_don_vi":2`) || strings.Contains(calls[0].Payload, `"p_don_vi":999`) {
		t.Fatalf("payload = %s", calls[0].Payload)
	}
	if !strings.Contains(calls[0].Payload, `"p_user_id":"42"`) || strings.Contains(calls[0].Payload, `"p_user_id":42`) {
		t.Fatalf("user id must be a JSON string: %s", calls[0].Payload)
	}
	if _, err := assistant.gate().Call(context.Background(), cred, RPCQuotaReserve, []byte(`{"p_user_id":"42"}`)); err != nil {
		t.Fatalf("chat path rejected quota reserve: %v", err)
	}
	if _, err := assistant.gate().Call(context.Background(), cred, RPCKillSwitch, []byte(`{}`)); err != nil {
		t.Fatalf("chat path rejected kill switch: %v", err)
	}
	calls = broker.snapshot()
	if len(calls) != 3 || calls[1].RPC != RPCQuotaReserve || calls[2].RPC != RPCKillSwitch {
		t.Fatalf("calls = %+v", calls)
	}
}

func TestAdminNormalizesToGlobalAndDoesNotQueryAllFacilities(t *testing.T) {
	cred := testCredential(" admin ", nil, facilityPtr(11))
	scope := resolveScope(cred, true)
	if scope.NormalizedRole != "global" || scope.RawRole != "admin" || scope.EffectiveFacilityID != 11 || scope.FacilitySource != facilitySourceSelected {
		t.Fatalf("scope = %+v", scope)
	}
	missing := resolveScope(testCredential("admin", nil, nil), true)
	if missing.Guidance != FacilityRequiredMessage || missing.EffectiveFacilityID != 0 {
		t.Fatalf("missing = %+v", missing)
	}
	executor := &spyQuery{}
	assistant := testAssistant(&spyBroker{}, executor)
	prepared, err := assistant.Prepare(context.Background(), testRequest(t, testCredential("admin", nil, nil), "yêu cầu sửa chữa đang tồn đọng", []string{"equipmentLookup", "repairSummary", "departmentList"}))
	if err != nil {
		t.Fatal(err)
	}
	if prepared.Clarification != FacilityRequiredMessage || len(prepared.Tools) != 0 || executor.count() != 0 {
		t.Fatalf("prepared = %+v", prepared)
	}
}

func resolvedScope(t *testing.T, role string, facility int64) Scope {
	t.Helper()
	scope := resolveScope(testCredential(role, facilityPtr(facility), nil), true)
	if scope.Guidance != "" {
		t.Fatal(scope.Guidance)
	}
	return scope
}

func catalogMust(name string) ToolSpec {
	spec, ok := catalogByName(name)
	if !ok {
		panic(name)
	}
	return spec
}

func expired(cred Credential) Credential {
	cred.IssuedAt = fixedNow.Add(-2 * time.Minute)
	cred.ExpiresAt = fixedNow.Add(-time.Minute)
	return cred
}

func mustMint(t *testing.T, cred Credential, mutate func(*credentialPayload)) string {
	t.Helper()
	payload := credentialPayload{
		Issuer: cred.Issuer, Audience: cred.Audience, IssuedAt: cred.IssuedAt.Unix(), ExpiresAt: cred.ExpiresAt.Unix(),
		UserID: cred.UserID, RawRole: cred.RawRole, SessionFacilityID: cred.SessionFacilityID, RequestedFacilityID: cred.RequestedFacilityID,
	}
	mutate(&payload)
	token, err := signPayload(testSecret(), payload)
	if err != nil {
		t.Fatal(err)
	}
	return token
}

func mustBrowser(t *testing.T, cred Credential) string {
	t.Helper()
	token, err := SignBrowserCookieToken(testSecret(), cred, "session=browser")
	if err != nil {
		t.Fatal(err)
	}
	return token
}
