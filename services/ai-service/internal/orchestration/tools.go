package orchestration

import (
	"context"
	"errors"
	"sync"

	"example.com/shared-ai-service/internal/capability"
	"github.com/cloudwego/eino/components/tool"
	"github.com/cloudwego/eino/schema"
)

var (
	errToolInput  = errors.New("tool input limit")
	errToolOutput = errors.New("tool output limit")
	errToolSteps  = errors.New("tool step limit")
)

type toolTrace struct {
	mu      sync.Mutex
	started int
	results []capability.ToolResult
}

func (t *toolTrace) begin(maxSteps int) (int, bool) {
	t.mu.Lock()
	defer t.mu.Unlock()
	if t.started >= maxSteps {
		return 0, false
	}
	t.started++
	return t.started, true
}

func (t *toolTrace) add(result capability.ToolResult) {
	t.mu.Lock()
	defer t.mu.Unlock()
	t.results = append(t.results, result)
}

func (t *toolTrace) snapshot() []capability.ToolResult {
	t.mu.Lock()
	defer t.mu.Unlock()
	out := make([]capability.ToolResult, len(t.results))
	copy(out, t.results)
	return out
}

type limitedTool struct {
	spec   capability.Tool
	limits toolLimits
	trace  *toolTrace
}

type toolLimits struct {
	maxSteps  int
	maxInput  int
	maxOutput int
}

func (t *limitedTool) Info(context.Context) (*schema.ToolInfo, error) {
	info := &schema.ToolInfo{Name: t.spec.Name, Desc: t.spec.Description}
	if len(t.spec.Parameters) > 0 {
		info.ParamsOneOf = schema.NewParamsOneOfByParams(t.spec.Parameters)
	}
	return info, nil
}

func (t *limitedTool) InvokableRun(ctx context.Context, arguments string, _ ...tool.Option) (string, error) {
	if err := ctx.Err(); err != nil {
		return "", err
	}
	if len(arguments) > t.limits.maxInput {
		return "", errToolInput
	}
	step, ok := t.trace.begin(t.limits.maxSteps)
	if !ok {
		return "", errToolSteps
	}
	callID := t.spec.Name + "-" + itoa(step)
	output, err := t.spec.Run(ctx, arguments)
	if err != nil {
		return "", err
	}
	if len(output) > t.limits.maxOutput {
		return "", errToolOutput
	}
	t.trace.add(capability.ToolResult{
		Name:      t.spec.Name,
		CallID:    callID,
		Arguments: arguments,
		Output:    output,
	})
	if t.spec.ModelOutput != nil {
		return t.spec.ModelOutput(output), nil
	}
	return output, nil
}

func bindTools(tools []capability.Tool, limits toolLimits) ([]tool.BaseTool, *toolTrace, error) {
	trace := &toolTrace{}
	bound := make([]tool.BaseTool, 0, len(tools))
	for _, spec := range tools {
		if spec.Run == nil {
			return nil, nil, errToolSteps
		}
		bound = append(bound, &limitedTool{spec: spec, limits: limits, trace: trace})
	}
	return bound, trace, nil
}

func itoa(value int) string {
	if value == 0 {
		return "0"
	}
	var digits [20]byte
	index := len(digits)
	for value > 0 {
		index--
		digits[index] = byte('0' + value%10)
		value /= 10
	}
	return string(digits[index:])
}
