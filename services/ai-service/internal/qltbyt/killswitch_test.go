package qltbyt

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"testing"
	"time"

	"example.com/shared-ai-service/internal/orchestration"
	"example.com/shared-ai-service/internal/protocol"
	"example.com/shared-ai-service/internal/registry"
	"example.com/shared-ai-service/internal/testmodel"
	"example.com/shared-ai-service/internal/usage"
)

func TestKillSwitchEnvCacheAndFailClosed(t *testing.T) {
	t.Run("env wins without a database read", func(t *testing.T) {
		t.Setenv("AI_KILL_SWITCH", "On")
		broker := &spyBroker{fail: map[string]error{RPCKillSwitch: errors.New("db down")}}
		assistant := testAssistant(broker, &spyQuery{})
		blocked, source, err := callerFor(t, assistant).KillSwitch(context.Background())
		if err != nil || !blocked || source != "env" || len(broker.snapshot()) != 0 {
			t.Fatalf("blocked=%v source=%s err=%v calls=%d", blocked, source, err, len(broker.snapshot()))
		}
	})
	t.Run("success cache lasts eight seconds", func(t *testing.T) {
		t.Setenv("AI_KILL_SWITCH", "")
		now := fixedNow
		broker := &spyBroker{bodies: map[string]json.RawMessage{RPCKillSwitch: []byte(`{"enabled":false}`)}}
		assistant := testAssistant(broker, &spyQuery{})
		assistant.Now = func() time.Time { return now }
		caller := callerFor(t, assistant)
		if blocked, _, err := caller.KillSwitch(context.Background()); err != nil || blocked {
			t.Fatal(err)
		}
		if _, _, err := caller.KillSwitch(context.Background()); err != nil || len(broker.snapshot()) != 1 {
			t.Fatalf("cache missed early: %d %v", len(broker.snapshot()), err)
		}
		now = now.Add(8 * time.Second)
		if _, _, err := caller.KillSwitch(context.Background()); err != nil || len(broker.snapshot()) != 2 {
			t.Fatalf("cache lived past 8s: %d %v", len(broker.snapshot()), err)
		}
	})
	t.Run("error cache fails closed for two seconds", func(t *testing.T) {
		t.Setenv("AI_KILL_SWITCH", "off")
		now := fixedNow
		broker := &spyBroker{fail: map[string]error{RPCKillSwitch: errors.New("db down")}}
		assistant := testAssistant(broker, &spyQuery{})
		assistant.Now = func() time.Time { return now }
		caller := callerFor(t, assistant)
		blocked, source, err := caller.KillSwitch(context.Background())
		if err != nil || !blocked || source != "db_error_fail_closed" || len(broker.snapshot()) != 1 {
			t.Fatalf("blocked=%v source=%s calls=%d err=%v", blocked, source, len(broker.snapshot()), err)
		}
		if _, _, err := caller.KillSwitch(context.Background()); err != nil || len(broker.snapshot()) != 1 {
			t.Fatal("error cache was not reused")
		}
		now = now.Add(2 * time.Second)
		if _, _, err := caller.KillSwitch(context.Background()); err != nil || len(broker.snapshot()) != 2 {
			t.Fatalf("error cache lived past 2s: %d", len(broker.snapshot()))
		}
	})
	t.Run("active switch does not open the provider", func(t *testing.T) {
		t.Setenv("AI_KILL_SWITCH", "on")
		broker := &spyBroker{}
		assistant := testAssistant(broker, &spyQuery{})
		book, err := usage.NewQuotaBook(t.TempDir(), func() time.Time { return fixedNow }, nil)
		if err != nil {
			t.Fatal(err)
		}
		opens := 0
		reg := registry.New()
		if err := Register(reg, assistant); err != nil {
			t.Fatal(err)
		}
		runner := &orchestration.Runner{
			Registry: reg,
			Usage:    book,
			Open: func(context.Context, protocol.Request) (orchestration.ModelSession, error) {
				opens++
				return localSession{chat: &testmodel.Scripted{}}, nil
			},
		}
		request := testRequest(t, testCredential("technician", facilityPtr(2), nil), "xin chào", nil)
		_, err = runner.Run(context.Background(), request)
		var serviceErr *protocol.Error
		if !errors.As(err, &serviceErr) || serviceErr.Message != usage.KillSwitchMessage || opens != 0 || len(broker.snapshot()) != 0 {
			t.Fatalf("err=%v opens=%d calls=%d", err, opens, len(broker.snapshot()))
		}
		if strings.Contains(serviceErr.Message, "kill_switch") || serviceErr.Code == "ai_usage_limited" {
			t.Fatalf("invented kill switch status: %+v", serviceErr)
		}
	})
}

func callerFor(t *testing.T, assistant Assistant) usage.QuotaCaller {
	t.Helper()
	prepared, err := assistant.Prepare(context.Background(), testRequest(t, testCredential("technician", facilityPtr(2), nil), "xin chào", nil))
	if err != nil {
		t.Fatal(err)
	}
	if prepared.QuotaCaller == nil {
		t.Fatal("missing quota caller")
	}
	return prepared.QuotaCaller
}
