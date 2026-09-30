package provider

import (
	"context"
	"sort"
	"sync"

	"example.com/shared-ai-service/internal/protocol"
	"github.com/cloudwego/eino/components/model"
)

// CapabilityProfile describes the contract that must stay stable across a
// fallback pair. It is configuration metadata; it never probes a provider.
type CapabilityProfile struct {
	Streaming     bool
	ToolCalling   bool
	ContextWindow int
	ToolSchema    string
	Policy        string
}

// DefaultChatProfile is the approved chat contract for the Phase 5.9 pairs.
var DefaultChatProfile = CapabilityProfile{
	Streaming:     true,
	ToolCalling:   true,
	ContextWindow: 1_000_000,
	ToolSchema:    "eino-v1",
	Policy:        "shared-chat-v1",
}

// ProviderModelPair is one ordered provider/model choice. Priority is a
// stable configuration value, not a dynamic routing score.
type ProviderModelPair struct {
	Priority     int
	Provider     string
	Model        string
	Config       Config
	Capabilities CapabilityProfile
}

// ChainConfig is the deterministic fallback policy. MaxAttempts is capped at
// two by contract; each pair is attempted at most once.
type ChainConfig struct {
	Pairs       []ProviderModelPair
	MaxAttempts int
}

// ApprovedPhase59Chain returns the approved provider/model pairs without
// credentials. The slice order is the original NVIDIA-first chain. Validation
// accepts either pair first when both approved pairs are present once.
func ApprovedPhase59Chain() []ProviderModelPair {
	return []ProviderModelPair{
		{Priority: 1, Provider: protocol.TransportNVIDIA, Model: "google/gemma-4-31b-it", Capabilities: DefaultChatProfile},
		{Priority: 2, Provider: protocol.TransportGoogle, Model: "gemini-3.5-flash-lite", Capabilities: DefaultChatProfile},
	}
}

// ChainSession presents one ordered chain through the existing Eino session
// surface. It contains no model loop of its own; Runner remains responsible
// for Eino generation, streaming and cancellation.
type ChainSession struct {
	mu          sync.Mutex
	pairs       []ProviderModelPair
	sessions    []Session
	maxAttempts int
	active      int
	used        []bool
	metadata    protocol.ProviderMetadata
}

func (s *ChainSession) Pair() ProviderModelPair {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.active >= len(s.pairs) {
		return ProviderModelPair{}
	}
	return s.pairs[s.active]
}

func (s *ChainSession) Transport() string { return s.Pair().Provider }

func (s *ChainSession) ModelName() string { return s.Pair().Model }

func (s *ChainSession) ThinkingLevel() string { return ThinkingLevel(s.ModelName()) }

func (s *ChainSession) KeyIndex() int {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.active
}

// NewChain opens every configured adapter without making an inference call.
// Opening is fail-closed: a missing secret or incompatible pair rejects the
// entire chain before readiness can claim it is usable.
func NewChain(ctx context.Context, cfg ChainConfig) (*ChainSession, error) {
	pairs, maxAttempts, err := validateChain(cfg)
	if err != nil {
		return nil, err
	}
	sessions := make([]Session, len(pairs))
	for i, pair := range pairs {
		opened, openErr := Open(ctx, pair.Config)
		if openErr != nil {
			return nil, wrapProviderError(pair, openErr)
		}
		sessions[i] = opened
	}
	return newChainSession(pairs, sessions, maxAttempts), nil
}

// NewFakeChain is used by deterministic tests and keeps network/provider SDKs
// outside the fallback proof. It applies the same validation as NewChain.
func NewFakeChain(cfg ChainConfig, sessions []Session) (*ChainSession, error) {
	pairs, maxAttempts, err := validateChain(cfg)
	if err != nil {
		return nil, err
	}
	if len(sessions) != len(pairs) {
		return nil, protocol.NewError(500, protocol.CodeInvalidRequest, "The provider chain has no adapter for a configured pair.", false)
	}
	for i, session := range sessions {
		if session == nil {
			return nil, protocol.NewError(500, protocol.CodeInvalidRequest, "The provider chain contains an empty adapter.", false)
		}
		if session.ModelName() != "" && session.ModelName() != pairs[i].Model {
			return nil, protocol.NewError(500, protocol.CodeInvalidRequest, "The provider chain adapter model does not match its pair.", false)
		}
	}
	return newChainSession(pairs, sessions, maxAttempts), nil
}

func newChainSession(pairs []ProviderModelPair, sessions []Session, maxAttempts int) *ChainSession {
	return &ChainSession{
		pairs:       pairs,
		sessions:    sessions,
		maxAttempts: maxAttempts,
		used:        make([]bool, len(pairs)),
		metadata: protocol.ProviderMetadata{
			Outcome: "in-progress",
		},
	}
}

// AttemptLimit never exceeds the chain's hard ceiling.
func (s *ChainSession) AttemptLimit() int {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.maxAttempts
}

// RotateOnQuota advances only after the runner proves no stream event was
// emitted. The failed pair is consumed exactly once.
func (s *ChainSession) RotateOnQuota(failedIndex int) bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	if failedIndex < 0 || failedIndex >= len(s.pairs) || failedIndex != s.active {
		return false
	}
	s.used[failedIndex] = true
	if failedIndex < len(s.metadata.Attempts) {
		s.metadata.Attempts[failedIndex].Outcome = "fallback"
		if s.metadata.Attempts[failedIndex].ErrorClass == "" {
			s.metadata.Attempts[failedIndex].ErrorClass = string(ErrorClassQuotaExhausted)
		}
	}
	for index := failedIndex + 1; index < len(s.pairs) && index < s.maxAttempts; index++ {
		if s.used[index] {
			continue
		}
		s.active = index
		return true
	}
	return false
}

func (s *ChainSession) ChatModel(ctx context.Context) (model.ToolCallingChatModel, int, error) {
	s.mu.Lock()
	index := s.active
	if index >= len(s.sessions) || index >= s.maxAttempts || s.used[index] {
		s.mu.Unlock()
		return nil, index, protocol.NewError(503, protocol.CodeProviderQuota, "The model provider is temporarily unavailable.", true)
	}
	pair := s.pairs[index]
	session := s.sessions[index]
	s.metadata.Provider = pair.Provider
	s.metadata.Model = pair.Model
	s.metadata.Attempts = append(s.metadata.Attempts, protocol.ProviderAttempt{Attempt: len(s.metadata.Attempts) + 1, Provider: pair.Provider, Model: pair.Model, Outcome: "started"})
	s.mu.Unlock()
	chat, _, err := session.ChatModel(ctx)
	if err != nil {
		return nil, index, wrapProviderError(pair, err)
	}
	return newAdapterModel(chat, pair), index, nil
}

func (s *ChainSession) StructuredModel(ctx context.Context) (model.ToolCallingChatModel, error) {
	s.mu.Lock()
	index := s.active
	if index >= len(s.sessions) || index >= s.maxAttempts || s.used[index] {
		s.mu.Unlock()
		return nil, protocol.NewError(503, protocol.CodeProviderQuota, "The model provider is temporarily unavailable.", true)
	}
	pair := s.pairs[index]
	session := s.sessions[index]
	s.mu.Unlock()
	chat, err := session.StructuredModel(ctx)
	if err != nil {
		return nil, wrapProviderError(pair, err)
	}
	return newAdapterModel(chat, pair), nil
}

func (s *ChainSession) Metadata() protocol.ProviderMetadata {
	s.mu.Lock()
	defer s.mu.Unlock()
	copyValue := s.metadata
	copyValue.Attempts = append([]protocol.ProviderAttempt(nil), s.metadata.Attempts...)
	return copyValue
}

// MarkOutcome records a request-level outcome and updates the active attempt.
// It is deliberately optional at the orchestration boundary.
func (s *ChainSession) MarkOutcome(outcome string, class ErrorClass) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.metadata.Outcome = outcome
	if len(s.metadata.Attempts) == 0 {
		return
	}
	last := &s.metadata.Attempts[len(s.metadata.Attempts)-1]
	last.Outcome = outcome
	if class != ErrorClassUnknown {
		last.ErrorClass = string(class)
	}
}

// MarkProviderOutcome is the neutral runner hook used for request metadata.
func (s *ChainSession) MarkProviderOutcome(outcome, class string) {
	s.MarkOutcome(outcome, ErrorClass(class))
}

func validateChain(cfg ChainConfig) ([]ProviderModelPair, int, error) {
	approved := ApprovedPhase59Chain()
	if len(cfg.Pairs) != len(approved) {
		return nil, 0, protocol.NewError(500, protocol.CodeInvalidRequest, "The provider fallback chain must contain the approved primary and fallback pairs.", false)
	}
	if cfg.MaxAttempts <= 0 {
		cfg.MaxAttempts = len(cfg.Pairs)
	}
	if cfg.MaxAttempts > 2 || cfg.MaxAttempts > len(cfg.Pairs) {
		return nil, 0, protocol.NewError(500, protocol.CodeInvalidRequest, "The provider fallback chain has an invalid attempt ceiling.", false)
	}
	approvedByPair := make(map[string]ProviderModelPair, len(approved))
	for _, pair := range approved {
		approvedByPair[pair.Provider+"\n"+pair.Model] = pair
	}
	pairs := append([]ProviderModelPair(nil), cfg.Pairs...)
	sort.SliceStable(pairs, func(i, j int) bool { return pairs[i].Priority < pairs[j].Priority })
	seen := make(map[string]struct{}, len(pairs))
	for i, pair := range pairs {
		if pair.Priority <= 0 || (i > 0 && pairs[i-1].Priority == pair.Priority) || pair.Provider == "" || pair.Model == "" {
			return nil, 0, protocol.NewError(500, protocol.CodeInvalidRequest, "The provider fallback chain has invalid or duplicate priorities.", false)
		}
		key := pair.Provider + "\n" + pair.Model
		approvedPair, ok := approvedByPair[key]
		if !ok {
			return nil, 0, protocol.NewError(500, protocol.CodeInvalidRequest, "The provider fallback chain contains an unapproved provider/model pair.", false)
		}
		if _, dup := seen[key]; dup {
			return nil, 0, protocol.NewError(500, protocol.CodeInvalidRequest, "The provider fallback chain contains an unapproved provider/model pair.", false)
		}
		seen[key] = struct{}{}
		if pair.Capabilities != approvedPair.Capabilities {
			return nil, 0, protocol.NewError(500, protocol.CodeInvalidRequest, "The provider fallback chain contains incompatible capabilities.", false)
		}
		if pair.Config.Transport != "" && pair.Config.Transport != pair.Provider {
			return nil, 0, protocol.NewError(500, protocol.CodeInvalidRequest, "The provider fallback pair transport does not match its provider.", false)
		}
		if pair.Config.Model != "" && pair.Config.Model != pair.Model {
			return nil, 0, protocol.NewError(500, protocol.CodeInvalidRequest, "The provider fallback pair model does not match its approved model.", false)
		}
	}
	if len(seen) != len(approved) {
		return nil, 0, protocol.NewError(500, protocol.CodeInvalidRequest, "The provider fallback chain must contain the approved primary and fallback pairs.", false)
	}
	return pairs, cfg.MaxAttempts, nil
}
