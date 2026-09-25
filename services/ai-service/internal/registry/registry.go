// Package registry stores versioned capability lookups.
package registry

import (
	"strings"
	"sync"

	"example.com/shared-ai-service/internal/capability"
	"example.com/shared-ai-service/internal/protocol"
)

// Registry resolves app, capability, and version tuples.
type Registry struct {
	mu    sync.RWMutex
	items map[string]capability.Capability
}

// New returns an empty registry.
func New() *Registry {
	return &Registry{items: make(map[string]capability.Capability)}
}

// Register adds one capability version. A second registration of the same tuple fails.
func (r *Registry) Register(item capability.Capability) error {
	if item == nil {
		return protocol.NewError(500, protocol.CodeInvalidRequest, "The capability is missing.", false)
	}
	descriptor := item.Descriptor()
	if strings.TrimSpace(descriptor.AppID) == "" ||
		strings.TrimSpace(descriptor.CapabilityID) == "" ||
		strings.TrimSpace(descriptor.Version) == "" {
		return protocol.NewError(500, protocol.CodeInvalidRequest, "The capability descriptor is incomplete.", false)
	}
	key := lookupKey(descriptor.AppID, descriptor.CapabilityID, descriptor.Version)
	r.mu.Lock()
	defer r.mu.Unlock()
	if _, exists := r.items[key]; exists {
		return protocol.NewError(409, protocol.CodeInvalidRequest, "The capability version is already registered.", false)
	}
	r.items[key] = item
	return nil
}

// Lookup returns the capability or a stable non-retryable error.
// The lookup does not call a provider or a tool.
func (r *Registry) Lookup(appID, capabilityID, version string) (capability.Capability, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	item := r.items[lookupKey(appID, capabilityID, version)]
	if item == nil {
		return nil, protocol.NewError(404, protocol.CodeCapabilityUnavailable, "The capability version is unavailable.", false)
	}
	return item, nil
}

func lookupKey(appID, capabilityID, version string) string {
	return appID + "\x00" + capabilityID + "\x00" + version
}
