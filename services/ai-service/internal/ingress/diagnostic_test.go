package ingress

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"example.com/shared-ai-service/fixtures/secondapp"
	"example.com/shared-ai-service/internal/capability"
	"example.com/shared-ai-service/internal/orchestration"
	"example.com/shared-ai-service/internal/protocol"
	"example.com/shared-ai-service/internal/registry"
	"example.com/shared-ai-service/internal/usage"
)

func TestIngressRejectsBrowserCookieAndCredentialWithoutOpeningModel(t *testing.T) {
	started := time.Unix(1_700_000_000, 0).UTC()
	now := started.Add(Quarantine)
	key := Key{
		ID:           "key-1",
		Secret:       []byte("secret-1"),
		Issuer:       "nextjs-bff",
		Audience:     "ai-service-v1",
		AppID:        secondapp.AppID,
		CapabilityID: secondapp.CapabilityID,
	}
	var opens atomic.Int32
	handler := testHandler(t, started, key, &opens, nil)
	cookieRequest := signedRequest(key, now, "probe-cookie")
	cookieHTTP := httptest.NewRequest(http.MethodPost, Path, strings.NewReader(string(cookieRequest.body)))
	copyHeaders(cookieHTTP, cookieRequest.header)
	cookieHTTP.Header.Set("Cookie", "session=do-not-log")
	cookieResponse := httptest.NewRecorder()
	handler.ServeHTTP(cookieResponse, cookieHTTP)
	if cookieResponse.Code != http.StatusUnauthorized || opens.Load() != 0 {
		t.Fatalf("cookie status=%d opens=%d", cookieResponse.Code, opens.Load())
	}
	if strings.Contains(cookieResponse.Body.String(), "do-not-log") || strings.Contains(cookieResponse.Body.String(), "secret-1") {
		t.Fatal("response included request material")
	}

	denyRegistry := registry.New()
	if err := denyRegistry.Register(denyCredentialCapability{}); err != nil {
		t.Fatal(err)
	}
	handler.Registry = denyRegistry
	handler.Runner = &orchestration.Runner{
		Registry: denyRegistry,
		Usage:    usage.NewMemory(func() time.Time { return started }),
		Open: func(context.Context, protocol.Request) (orchestration.ModelSession, error) {
			opens.Add(1)
			return nil, nil
		},
	}
	credentialResponse := post(handler, signedRequest(key, now, "probe-credential"))
	if credentialResponse.Code != http.StatusUnauthorized || opens.Load() != 0 {
		t.Fatalf("credential status=%d opens=%d body=%s", credentialResponse.Code, opens.Load(), credentialResponse.Body.String())
	}
}

type denyCredentialCapability struct{}

func (denyCredentialCapability) Descriptor() capability.Descriptor {
	return capability.Descriptor{AppID: secondapp.AppID, CapabilityID: secondapp.CapabilityID, Version: "v1"}
}

func (denyCredentialCapability) Authorize(context.Context, protocol.Request) error {
	return protocol.NewError(http.StatusUnauthorized, protocol.CodeUnauthorized, "The request is not authorized.", false)
}

func (denyCredentialCapability) Prepare(context.Context, protocol.Request) (capability.Prepared, error) {
	return capability.Prepared{}, nil
}

func (denyCredentialCapability) AfterPrimary(context.Context, protocol.Request, capability.PrimaryOutput) (capability.FollowUp, error) {
	return capability.FollowUp{}, nil
}
