// Package secondapp is a boundary fixture for an app other than the first production adapter.
package secondapp

import (
	"context"
	"encoding/json"

	"example.com/shared-ai-service/internal/capability"
	"example.com/shared-ai-service/internal/protocol"
	"github.com/cloudwego/eino/schema"
)

const (
	AppID        = "second-app"
	CapabilityID = "inventory-note"
	Version      = "v1"
	ToolName     = "lookup_item"
)

// Capability exercises the shared core without a host-specific data client.
type Capability struct{}

func (Capability) Descriptor() capability.Descriptor {
	return capability.Descriptor{
		AppID:           AppID,
		CapabilityID:    CapabilityID,
		Version:         Version,
		PromptFragments: []string{"Reply with the lookup result only."},
		ArtifactSchemas: []string{"note"},
	}
}

func (Capability) Authorize(context.Context, protocol.Request) error { return nil }

func (Capability) Prepare(_ context.Context, request protocol.Request) (capability.Prepared, error) {
	return capability.Prepared{
		Messages: request.Messages,
		Tools: []capability.Tool{{
			Name:        ToolName,
			Description: "Look up one inventory item.",
			Parameters: map[string]*schema.ParameterInfo{
				"value": {Type: schema.String, Desc: "item identifier", Required: true},
			},
			Run: func(_ context.Context, _ string) (string, error) {
				return "item:phase1", nil
			},
		}},
	}, nil
}

func (Capability) AfterPrimary(context.Context, protocol.Request, capability.PrimaryOutput) (capability.FollowUp, error) {
	payload, err := json.Marshal(map[string]string{"note": "ready"})
	if err != nil {
		return capability.FollowUp{}, err
	}
	return capability.FollowUp{
		Artifacts: []protocol.Artifact{{Name: "note", Payload: payload}},
		Extraction: []protocol.Message{{
			Role:    protocol.RoleUser,
			Content: `Return JSON {"status":"ready"}.`,
		}},
	}, nil
}
