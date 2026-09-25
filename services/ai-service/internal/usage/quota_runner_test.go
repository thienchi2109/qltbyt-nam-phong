package usage_test

import (
	"context"
	"errors"
	"sync"
	"testing"
	"time"

	"example.com/shared-ai-service/internal/capability"
	"example.com/shared-ai-service/internal/orchestration"
	"example.com/shared-ai-service/internal/protocol"
	"example.com/shared-ai-service/internal/registry"
	"example.com/shared-ai-service/internal/testmodel"
	"example.com/shared-ai-service/internal/usage"
	"github.com/cloudwego/eino/components/model"
	"github.com/cloudwego/eino/schema"
)

type runnerFinalize struct {
	status string
}

type runnerCaller struct {
	mu        sync.Mutex
	blocked   bool
	kills     int
	reserves  int
	reserveID string
	finalizes []runnerFinalize
	hang      bool
}

func (s *runnerCaller) KillSwitch(context.Context) (bool, string, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.kills++
	return s.blocked, "spy", nil
}

func (s *runnerCaller) ReserveQuota(context.Context, *int64) (string, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.reserves++
	return s.reserveID, nil
}

func (s *runnerCaller) FinalizeQuota(ctx context.Context, _ string, status string, _, _ int64) error {
	if s.hang {
		<-ctx.Done()
		return ctx.Err()
	}
	s.mu.Lock()
	s.finalizes = append(s.finalizes, runnerFinalize{status: status})
	s.mu.Unlock()
	return nil
}

func (s *runnerCaller) finalizeCount() int {
	s.mu.Lock()
	defer s.mu.Unlock()
	return len(s.finalizes)
}

type quotaCapability struct {
	caller  usage.QuotaCaller
	clarify bool
}

func (quotaCapability) Descriptor() capability.Descriptor {
	return capability.Descriptor{AppID: "second-app", CapabilityID: "echo", Version: "v1"}
}

func (quotaCapability) Authorize(context.Context, protocol.Request) error { return nil }

func (c quotaCapability) Prepare(_ context.Context, request protocol.Request) (capability.Prepared, error) {
	if c.clarify {
		return capability.Prepared{Clarification: "Need a narrower question."}, nil
	}
	tenant := int64(9)
	return capability.Prepared{
		Messages:      request.Messages,
		QuotaUserID:   "42",
		QuotaTenantID: &tenant,
		QuotaRole:     "admin",
		QuotaCaller:   c.caller,
	}, nil
}

func (quotaCapability) AfterPrimary(context.Context, protocol.Request, capability.PrimaryOutput) (capability.FollowUp, error) {
	return capability.FollowUp{}, nil
}

func TestDuplicateRefundedRequestDoesNotOpenOrReserveAgain(t *testing.T) {
	spy := &runnerCaller{reserveID: "res-dup"}
	book, err := usage.NewQuotaBook(t.TempDir(), func() time.Time { return time.Unix(1_700_000_000, 0).UTC() }, spy)
	if err != nil {
		t.Fatal(err)
	}
	opens := 0
	runner := &orchestration.Runner{
		Registry: registryWith(t, quotaCapability{caller: spy}),
		Usage:    book,
		Open: func(context.Context, protocol.Request) (orchestration.ModelSession, error) {
			opens++
			return nil, errors.New("provider did not start")
		},
	}
	request := quotaRequest()
	first, err := runner.Run(context.Background(), request)
	if err == nil || !first.Reconciliation.Refund || opens != 1 || spy.reserves != 1 || spy.finalizeCount() != 1 || spy.finalizes[0].status != "error_no_usage" {
		t.Fatalf("first err=%v refund=%v opens=%d reserves=%d finalizes=%+v", err, first.Reconciliation.Refund, opens, spy.reserves, spy.finalizes)
	}
	_, err = runner.Run(context.Background(), request)
	var serviceErr *protocol.Error
	if !errors.As(err, &serviceErr) || serviceErr.Status != 409 || serviceErr.Message != "The request is already reserved." || opens != 1 || spy.reserves != 1 {
		t.Fatalf("duplicate err=%v opens=%d reserves=%d", err, opens, spy.reserves)
	}
}

func TestIntentWriteFailureDoesNotOpenProvider(t *testing.T) {
	spy := &runnerCaller{reserveID: "res-intent"}
	book, err := usage.NewQuotaBook(t.TempDir(), func() time.Time { return time.Unix(1_700_000_000, 0).UTC() }, spy)
	if err != nil {
		t.Fatal(err)
	}
	book.FailNextAppends(1)
	opens := 0
	runner := &orchestration.Runner{
		Registry: registryWith(t, quotaCapability{caller: spy}),
		Usage:    book,
		Open: func(context.Context, protocol.Request) (orchestration.ModelSession, error) {
			opens++
			return nil, nil
		},
	}
	if _, err := runner.Run(context.Background(), quotaRequest()); err == nil || opens != 0 || spy.reserves != 1 || spy.finalizeCount() != 1 || spy.finalizes[0].status != "error_no_usage" {
		t.Fatalf("err=%v opens=%d reserves=%d finalizes=%+v", err, opens, spy.reserves, spy.finalizes)
	}
}

func TestKillSwitchFailsClosedBeforeProvider(t *testing.T) {
	spy := &runnerCaller{reserveID: "res-kill", blocked: true}
	book, err := usage.NewQuotaBook(t.TempDir(), func() time.Time { return time.Unix(1_700_000_000, 0).UTC() }, spy)
	if err != nil {
		t.Fatal(err)
	}
	opens := 0
	runner := &orchestration.Runner{
		Registry: registryWith(t, quotaCapability{caller: spy}),
		Usage:    book,
		Open: func(context.Context, protocol.Request) (orchestration.ModelSession, error) {
			opens++
			return nil, nil
		},
	}
	_, err = runner.Run(context.Background(), quotaRequest())
	var serviceErr *protocol.Error
	if !errors.As(err, &serviceErr) || serviceErr.Status != 429 || serviceErr.Message != usage.KillSwitchMessage || opens != 0 || spy.reserves != 0 || spy.kills != 1 {
		t.Fatalf("err=%v opens=%d reserves=%d kills=%d", err, opens, spy.reserves, spy.kills)
	}
}

func TestClarificationSkipsKillSwitchAndReserve(t *testing.T) {
	spy := &runnerCaller{reserveID: "res-clarify"}
	book, err := usage.NewQuotaBook(t.TempDir(), func() time.Time { return time.Unix(1_700_000_000, 0).UTC() }, spy)
	if err != nil {
		t.Fatal(err)
	}
	opens := 0
	runner := &orchestration.Runner{
		Registry: registryWith(t, quotaCapability{caller: spy, clarify: true}),
		Usage:    book,
		Open: func(context.Context, protocol.Request) (orchestration.ModelSession, error) {
			opens++
			return nil, nil
		},
	}
	result, err := runner.Run(context.Background(), quotaRequest())
	if err != nil || result.Reserved || opens != 0 || spy.kills != 0 || spy.reserves != 0 {
		t.Fatalf("err=%v reserved=%v opens=%d kills=%d reserves=%d", err, result.Reserved, opens, spy.kills, spy.reserves)
	}
}

func TestRunnerCleanupDeadlineCutsHungFinalize(t *testing.T) {
	spy := &runnerCaller{reserveID: "res-clean"}
	book, err := usage.NewQuotaBook(t.TempDir(), func() time.Time { return time.Unix(1_700_000_000, 0).UTC() }, spy)
	if err != nil {
		t.Fatal(err)
	}
	var deadline time.Duration
	spyHang := false
	runner := &orchestration.Runner{
		Registry: registryWith(t, quotaCapability{caller: &deadlineCaller{inner: spy, deadline: &deadline, hang: &spyHang}}),
		Usage:    book,
		Open: func(context.Context, protocol.Request) (orchestration.ModelSession, error) {
			return plainSession{chat: &testmodel.Scripted{GenerateFunc: func(context.Context, []*schema.Message) (*schema.Message, error) {
				return testmodel.UsageMessage("ok", "stop", 1, 1), nil
			}}}, nil
		},
	}
	if _, err := runner.Run(context.Background(), quotaRequest()); err != nil {
		t.Fatal(err)
	}
	if deadline <= 0 || deadline > protocol.CleanupBudget {
		t.Fatalf("cleanup deadline = %s", deadline)
	}
	spyHang = true
	spy.hang = true
	spy.reserveID = "res-clean-2"
	runner.Cleanup = 40 * time.Millisecond
	started := time.Now()
	_, err = runner.Run(context.Background(), protocolRequest("req-clean-2"))
	if !errors.Is(err, context.DeadlineExceeded) || time.Since(started) > time.Second {
		t.Fatalf("hung cleanup err=%v elapsed=%s", err, time.Since(started))
	}
}

type deadlineCaller struct {
	inner    *runnerCaller
	deadline *time.Duration
	hang     *bool
}

func (c deadlineCaller) KillSwitch(ctx context.Context) (bool, string, error) {
	return c.inner.KillSwitch(ctx)
}

func (c deadlineCaller) ReserveQuota(ctx context.Context, tenantID *int64) (string, error) {
	return c.inner.ReserveQuota(ctx, tenantID)
}

func (c deadlineCaller) FinalizeQuota(ctx context.Context, reservationID, status string, inputTokens, outputTokens int64) error {
	if until, ok := ctx.Deadline(); ok {
		*c.deadline = time.Until(until)
	}
	if c.hang != nil && *c.hang {
		c.inner.hang = true
	}
	return c.inner.FinalizeQuota(ctx, reservationID, status, inputTokens, outputTokens)
}

type plainSession struct {
	chat model.ToolCallingChatModel
}

func (plainSession) AttemptLimit() int      { return 1 }
func (plainSession) RotateOnQuota(int) bool { return false }
func (s plainSession) ChatModel(context.Context) (model.ToolCallingChatModel, int, error) {
	return s.chat, 0, nil
}
func (s plainSession) StructuredModel(context.Context) (model.ToolCallingChatModel, error) {
	return s.chat, nil
}

func registryWith(t *testing.T, item capability.Capability) *registry.Registry {
	t.Helper()
	reg := registry.New()
	if err := reg.Register(item); err != nil {
		t.Fatal(err)
	}
	return reg
}

func quotaRequest() protocol.Request {
	return protocolRequest("req-quota")
}

func protocolRequest(id string) protocol.Request {
	return protocol.Request{
		ProtocolVersion: protocol.ProtocolVersion, AppID: "second-app", CapabilityID: "echo", CapabilityVersion: "v1",
		RequestID: id, Messages: []protocol.Message{{Role: protocol.RoleUser, Content: "hello"}},
	}
}
