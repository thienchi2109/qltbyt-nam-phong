package phase0proof

import "testing"

type usageKnowledge string

const (
	knownZero          usageKnowledge = "known-zero"
	knownPositive      usageKnowledge = "known-positive"
	partial            usageKnowledge = "partial"
	unknown            usageKnowledge = "unknown"
	providerNotStarted usageKnowledge = "provider-not-started"
)

type quotaMapping struct {
	status       string
	inputTokens  int
	outputTokens int
	uncertainty  string
	refund       bool
}

func mapUsage(kind usageKnowledge, inputTokens, outputTokens int) quotaMapping {
	switch kind {
	case knownZero:
		return quotaMapping{status: "success", uncertainty: "measured"}
	case knownPositive:
		return quotaMapping{
			status:       "success",
			inputTokens:  inputTokens,
			outputTokens: outputTokens,
			uncertainty:  "measured",
		}
	case partial:
		return quotaMapping{
			status:       "error_with_usage",
			inputTokens:  maxZero(inputTokens),
			outputTokens: maxZero(outputTokens),
			uncertainty:  "partial",
		}
	case unknown:
		return quotaMapping{status: "error_with_usage", uncertainty: "unknown"}
	case providerNotStarted:
		return quotaMapping{status: "error_no_usage", uncertainty: "known-no-provider-work", refund: true}
	default:
		return quotaMapping{status: "error_with_usage", uncertainty: "unknown"}
	}
}

func finalizeObservedUsage(providerStarted bool, inputTokens, outputTokens *int) quotaMapping {
	if !providerStarted {
		return mapUsage(providerNotStarted, 0, 0)
	}
	if inputTokens == nil && outputTokens == nil {
		return mapUsage(unknown, 0, 0)
	}
	if inputTokens == nil {
		return mapUsage(partial, 0, *outputTokens)
	}
	if outputTokens == nil {
		return mapUsage(partial, *inputTokens, 0)
	}
	return mapUsage(knownPositive, *inputTokens, *outputTokens)
}

func maxZero(value int) int {
	if value < 0 {
		return 0
	}
	return value
}

func TestUsageMappingKeepsUnknownDistinctFromMeasuredZero(t *testing.T) {
	tests := []struct {
		name   string
		kind   usageKnowledge
		input  int
		output int
		want   quotaMapping
	}{
		{name: "known zero", kind: knownZero, want: quotaMapping{status: "success", uncertainty: "measured"}},
		{name: "known positive", kind: knownPositive, input: 12, output: 8, want: quotaMapping{status: "success", inputTokens: 12, outputTokens: 8, uncertainty: "measured"}},
		{name: "partial", kind: partial, input: 12, output: -1, want: quotaMapping{status: "error_with_usage", inputTokens: 12, uncertainty: "partial"}},
		{name: "unknown", kind: unknown, want: quotaMapping{status: "error_with_usage", uncertainty: "unknown"}},
		{name: "provider not started", kind: providerNotStarted, want: quotaMapping{status: "error_no_usage", uncertainty: "known-no-provider-work", refund: true}},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			if got := mapUsage(test.kind, test.input, test.output); got != test.want {
				t.Fatalf("mapping = %+v, want %+v", got, test.want)
			}
		})
	}
	if measuredZero := mapUsage(knownZero, 0, 0); measuredZero == mapUsage(unknown, 0, 0) {
		t.Fatal("unknown usage collapsed into measured zero")
	}
}

func TestFinalizeObservedUsagePreservesPartialInputUsage(t *testing.T) {
	inputTokens := 12
	got := finalizeObservedUsage(true, &inputTokens, nil)
	want := quotaMapping{status: "error_with_usage", inputTokens: 12, uncertainty: "partial"}
	if got != want {
		t.Fatalf("partial input usage = %+v, want %+v", got, want)
	}
}

func TestFinalizeObservedUsagePreservesPartialOutputUsage(t *testing.T) {
	outputTokens := 8
	got := finalizeObservedUsage(true, nil, &outputTokens)
	want := quotaMapping{status: "error_with_usage", outputTokens: 8, uncertainty: "partial"}
	if got != want {
		t.Fatalf("partial output usage = %+v, want %+v", got, want)
	}
}
