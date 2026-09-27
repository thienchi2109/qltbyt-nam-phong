package protocol

import (
	"errors"
	"testing"
)

func TestProviderFallbackRequiresTypedError(t *testing.T) {
	if IsProviderFallbackEligible(errors.New("status 429 quota exceeded")) {
		t.Fatal("raw provider text was treated as fallback-eligible")
	}
	if !IsProviderFallbackEligible(NewError(503, CodeProviderQuota, "quota", true)) {
		t.Fatal("typed provider quota was not fallback-eligible")
	}
}
