package orchestration

import (
	"context"
	"errors"
	"sync"
	"testing"

	"example.com/shared-ai-service/internal/protocol"
	"example.com/shared-ai-service/internal/registry"
	"example.com/shared-ai-service/internal/testmodel"
	"example.com/shared-ai-service/internal/usage"
	"github.com/cloudwego/eino/components/model"
	"github.com/cloudwego/eino/schema"
)

func TestAuthorizeCancellationStaysCancelled(t *testing.T) {
	session := &staticSession{chat: &testmodel.Scripted{}}
	runner, _, opens := newRunner(t, cancelAuthorizeCapability{}, session)
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	_, err := runner.Run(ctx, testRequest())
	var serviceErr *protocol.Error
	if !errors.As(err, &serviceErr) || !errors.Is(err, context.Canceled) || serviceErr.Code != protocol.CodeCancelled || serviceErr.Status == 403 || *opens != 0 {
		t.Fatalf("err=%v opens=%d", err, *opens)
	}
}

type shiftingSession struct {
	mu     sync.Mutex
	active int
	marked []int
	chat   model.ToolCallingChatModel
}

func (s *shiftingSession) AttemptLimit() int { return 2 }
func (s *shiftingSession) RotateOnQuota(index int) bool {
	s.mu.Lock()
	s.marked = append(s.marked, index)
	s.mu.Unlock()
	return false
}
func (s *shiftingSession) ChatModel(context.Context) (model.ToolCallingChatModel, int, error) {
	s.mu.Lock()
	leased := s.active
	s.mu.Unlock()
	return s.chat, leased, nil
}
func (s *shiftingSession) StructuredModel(context.Context) (model.ToolCallingChatModel, error) {
	return s.chat, nil
}
func (s *shiftingSession) KeyIndex() int {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.active
}

func TestConcurrentQuotaRotationUsesTheLeasedKey(t *testing.T) {
	started := make(chan struct{})
	release := make(chan struct{})
	session := &shiftingSession{
		chat: &testmodel.Scripted{GenerateFunc: func(context.Context, []*schema.Message) (*schema.Message, error) {
			close(started)
			<-release
			return nil, errors.New("429 quota exceeded")
		}},
	}
	reg := registry.New()
	if err := reg.Register(echoCapability{}); err != nil {
		t.Fatal(err)
	}
	runner := &Runner{
		Registry: reg,
		Usage:    usage.NewMemory(nil),
		Open: func(context.Context, protocol.Request) (ModelSession, error) {
			return session, nil
		},
	}
	done := make(chan struct{})
	go func() {
		defer close(done)
		<-started
		session.mu.Lock()
		session.active = 1
		session.mu.Unlock()
		close(release)
	}()
	_, err := runner.Run(context.Background(), testRequest())
	<-done
	var serviceErr *protocol.Error
	if !errors.As(err, &serviceErr) || serviceErr.Code != protocol.CodeProviderQuota {
		t.Fatalf("err = %v", err)
	}
	session.mu.Lock()
	marked := append([]int(nil), session.marked...)
	session.mu.Unlock()
	if len(marked) != 1 || marked[0] != 0 {
		t.Fatalf("rotated keys = %v, want the leased key 0", marked)
	}
	if session.KeyIndex() == 0 {
		t.Fatal("active index did not move during the provider call")
	}
}
