package orchestration

import (
	"context"

	"github.com/cloudwego/eino/components/model"
)

// ModelSession is the provider surface the runner needs.
// Capability packages do not implement or import a provider SDK through this type.
type ModelSession interface {
	AttemptLimit() int
	RotateOnQuota(failedIndex int) bool
	// ChatModel returns the model and the key index leased for that model.
	ChatModel(ctx context.Context) (model.ToolCallingChatModel, int, error)
	StructuredModel(ctx context.Context) (model.ToolCallingChatModel, error)
}
