package phase0proof

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
)

type parityFixture struct {
	SchemaVersion string `json:"schema_version"`
	Baseline      struct {
		Route  string `json:"route"`
		Stream string `json:"stream"`
	} `json:"baseline"`
	Cases []struct {
		ID        string `json:"id"`
		DraftOnly bool   `json:"draft_only"`
		Submit    bool   `json:"submit"`
		Parts     []struct {
			Type   string `json:"type"`
			Marker string `json:"marker"`
		} `json:"parts"`
	} `json:"cases"`
}

func TestUIAndToolParityFixtureIsConsumed(t *testing.T) {
	data, err := os.ReadFile(filepath.Join("..", "fixtures", "ui-tool-parity.json"))
	if err != nil {
		t.Fatal(err)
	}
	var fixture parityFixture
	if err := json.Unmarshal(data, &fixture); err != nil {
		t.Fatal(err)
	}
	if fixture.SchemaVersion == "" || fixture.Baseline.Route != "/api/chat" || fixture.Baseline.Stream == "" {
		t.Fatalf("invalid parity baseline = %+v", fixture.Baseline)
	}
	seen := make(map[string]bool, len(fixture.Cases))
	for _, testCase := range fixture.Cases {
		seen[testCase.ID] = true
		terminal := false
		sanitizedQuotaError := false
		for _, part := range testCase.Parts {
			if part.Type == "terminal" && part.Marker == "finish/DONE" {
				terminal = true
			}
			if testCase.ID == "sanitized-error" && part.Type == "error" {
				sanitizedQuotaError = true
			}
		}
		if testCase.ID != "sanitized-error" && !terminal {
			t.Fatalf("fixture case %q has no terminal marker", testCase.ID)
		}
		if testCase.ID == "sanitized-error" && !sanitizedQuotaError {
			t.Fatal("sanitized error fixture is missing its error part")
		}
	}
	if !seen["mixed-tool-envelope"] || !seen["sanitized-error"] {
		t.Fatalf("fixture cases = %v", seen)
	}
	if !seen["raw-repair-draft-output"] {
		t.Fatal("repair draft case is missing")
	}
	for _, testCase := range fixture.Cases {
		if testCase.ID == "raw-repair-draft-output" && (!testCase.DraftOnly || testCase.Submit) {
			t.Fatalf("repair draft fixture is not draft-only = %+v", testCase)
		}
	}
}
