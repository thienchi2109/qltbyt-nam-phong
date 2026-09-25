// Package capability is the registration contract implemented by each app.
package capability

import (
	"context"

	"example.com/shared-ai-service/internal/protocol"
	"github.com/cloudwego/eino/schema"
)

// Descriptor identifies one versioned capability and its prompt fragments.
type Descriptor struct {
	AppID           string
	CapabilityID    string
	Version         string
	PromptFragments []string
	ArtifactSchemas []string
}

// Tool is one capability-owned executor. The provider SDK stays outside this type.
type Tool struct {
	Name        string
	Description string
	Parameters  map[string]*schema.ParameterInfo
	Run         func(ctx context.Context, argumentsJSON string) (string, error)
}

// Prepared is the capability view of one request before model execution.
type Prepared struct {
	Messages      []protocol.Message
	Tools         []Tool
	Clarification string
}

// FollowUp is optional work the capability owns after the primary model result.
type FollowUp struct {
	Artifacts  []protocol.Artifact
	Extraction []protocol.Message
}

// PrimaryOutput is the text and tool transcript the capability may inspect.
type PrimaryOutput struct {
	Text        string
	ToolResults []ToolResult
}

// ToolResult is one executed tool call.
type ToolResult struct {
	Name      string
	CallID    string
	Arguments string
	Output    string
}

// Capability is the app-owned surface. Routing IDs do not grant authorization.
type Capability interface {
	Descriptor() Descriptor
	Authorize(ctx context.Context, request protocol.Request) error
	Prepare(ctx context.Context, request protocol.Request) (Prepared, error)
	AfterPrimary(ctx context.Context, request protocol.Request, primary PrimaryOutput) (FollowUp, error)
}
