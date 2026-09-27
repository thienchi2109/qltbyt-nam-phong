package protocol

import (
	"errors"
)

// IsProviderFallbackEligible consumes the adapter marker without importing a
// provider SDK into orchestration.
func IsProviderFallbackEligible(err error) bool {
	if err == nil {
		return false
	}
	var marker interface{ ProviderFallbackEligible() bool }
	if errors.As(err, &marker) && marker != nil {
		return marker.ProviderFallbackEligible()
	}
	var serviceErr *Error
	if errors.As(err, &serviceErr) && serviceErr != nil && serviceErr.Code == CodeProviderQuota {
		return true
	}
	return false
}
