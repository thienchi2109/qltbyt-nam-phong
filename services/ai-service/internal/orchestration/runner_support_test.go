package orchestration

import (
	"context"
	"strings"
	"testing"
	"time"

	"example.com/shared-ai-service/internal/capability"
	"example.com/shared-ai-service/internal/protocol"
	"example.com/shared-ai-service/internal/registry"
	"example.com/shared-ai-service/internal/usage"
	"github.com/cloudwego/eino/components/model"
)

type staticSession struct {
	chat       model.ToolCallingChatModel
	structured model.ToolCallingChatModel
	limit      int
	index      int
	rotations  int
	opens      *int
}

func (s *staticSession) KeyIndex() int { return s.index }
func (s *staticSession) AttemptLimit() int {
	if s.limit == 0 {
		return 1
	}
	return s.limit
}
func (s *staticSession) RotateOnQuota(int) bool {
	s.rotations++
	if s.rotations >= s.limit {
		return false
	}
	s.index++
	return true
}
func (s *staticSession) ChatModel(context.Context) (model.ToolCallingChatModel, error) {
	return s.chat, nil
}
func (s *staticSession) StructuredModel(context.Context) (model.ToolCallingChatModel, error) {
	if s.structured != nil {
		return s.structured, nil
	}
	return s.chat, nil
}

type echoCapability struct {
	clarify bool
	tool    string
}

func (c echoCapability) Descriptor() capability.Descriptor {
	return capability.Descriptor{AppID: "second-app", CapabilityID: "echo", Version: "v1", PromptFragments: []string{"Be brief."}}
}
func (echoCapability) Authorize(context.Context, protocol.Request) error { return nil }
func (c echoCapability) Prepare(_ context.Context, request protocol.Request) (capability.Prepared, error) {
	if c.clarify {
		return capability.Prepared{Clarification: "Need a narrower question."}, nil
	}
	prepared := capability.Prepared{Messages: request.Messages}
	if c.tool != "" {
		prepared.Tools = []capability.Tool{{
			Name: c.tool,
			Run: func(ctx context.Context, arguments string) (string, error) {
				if err := ctx.Err(); err != nil {
					return "", err
				}
				return "tool:" + arguments, nil
			},
		}}
	}
	return prepared, nil
}
func (echoCapability) AfterPrimary(context.Context, protocol.Request, capability.PrimaryOutput) (capability.FollowUp, error) {
	return capability.FollowUp{}, nil
}

func testRequest() protocol.Request {
	return protocol.Request{
		ProtocolVersion:   protocol.ProtocolVersion,
		AppID:             "second-app",
		CapabilityID:      "echo",
		CapabilityVersion: "v1",
		RequestID:         "req-1",
		Messages:          []protocol.Message{{Role: protocol.RoleUser, Content: "hello"}},
		Context:           map[string]any{"selected_facility_name": "display only"},
		Identity:          protocol.Identity{Tenant: "not-a-quota-tenant"},
	}
}

func newRunner(t *testing.T, item capability.Capability, session *staticSession) (*Runner, *usage.Memory, *int) {
	t.Helper()
	reg := registry.New()
	if err := reg.Register(item); err != nil {
		t.Fatal(err)
	}
	opens := 0
	book := usage.NewMemory(func() time.Time { return time.Unix(1_700_000_000, 0) })
	runner := &Runner{
		Registry: reg,
		Usage:    book,
		Open: func(context.Context, protocol.Request) (ModelSession, error) {
			opens++
			session.opens = &opens
			return session, nil
		},
	}
	return runner, book, &opens
}

type blockingCapability struct {
	started chan struct{}
}

func (blockingCapability) Descriptor() capability.Descriptor {
	return capability.Descriptor{AppID: "second-app", CapabilityID: "echo", Version: "v1"}
}
func (blockingCapability) Authorize(context.Context, protocol.Request) error { return nil }
func (c blockingCapability) Prepare(context.Context, protocol.Request) (capability.Prepared, error) {
	return capability.Prepared{
		Messages: []protocol.Message{{Role: protocol.RoleUser, Content: "hello"}},
		Tools: []capability.Tool{{
			Name: "lookup_item",
			Run: func(ctx context.Context, _ string) (string, error) {
				close(c.started)
				<-ctx.Done()
				return "", ctx.Err()
			},
		}},
	}, nil
}
func (blockingCapability) AfterPrimary(context.Context, protocol.Request, capability.PrimaryOutput) (capability.FollowUp, error) {
	return capability.FollowUp{}, nil
}

type countingCapability struct {
	runs *int
}

func (countingCapability) Descriptor() capability.Descriptor {
	return capability.Descriptor{AppID: "second-app", CapabilityID: "echo", Version: "v1"}
}
func (countingCapability) Authorize(context.Context, protocol.Request) error { return nil }
func (c countingCapability) Prepare(context.Context, protocol.Request) (capability.Prepared, error) {
	return capability.Prepared{
		Messages: []protocol.Message{{Role: protocol.RoleUser, Content: "hello"}},
		Tools: []capability.Tool{{
			Name: "lookup_item",
			Run: func(context.Context, string) (string, error) {
				*c.runs++
				return "ok", nil
			},
		}},
	}, nil
}
func (countingCapability) AfterPrimary(context.Context, protocol.Request, capability.PrimaryOutput) (capability.FollowUp, error) {
	return capability.FollowUp{}, nil
}

func eventTypes(events []protocol.Event) []string {
	types := make([]string, len(events))
	for i, event := range events {
		types[i] = event.Type
	}
	return types
}

func hasEventSequence(events []protocol.Event, want ...string) bool {
	types := eventTypes(events)
	index := 0
	for _, eventType := range types {
		if index < len(want) && eventType == want[index] {
			index++
		}
	}
	return index == len(want)
}

func eventText(events []protocol.Event) string {
	var text strings.Builder
	for _, event := range events {
		if event.Type == protocol.EventText {
			text.WriteString(event.Text)
		}
	}
	return text.String()
}
