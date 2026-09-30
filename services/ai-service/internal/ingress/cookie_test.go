package ingress

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"example.com/shared-ai-service/fixtures/secondapp"
)

func TestIngressAllowsAccessCookiesAndStillRequiresHMAC(t *testing.T) {
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

	accessRequest := signedRequest(key, now, "probe-access")
	accessHTTP := httptest.NewRequest(http.MethodPost, Path, strings.NewReader(string(accessRequest.body)))
	copyHeaders(accessHTTP, accessRequest.header)
	accessHTTP.Header.Del(HeaderSignature)
	accessHTTP.Header.Set("Cookie", "CF_Authorization=do-not-log; CF_AppSession=also-secret")
	accessResponse := httptest.NewRecorder()
	handler.ServeHTTP(accessResponse, accessHTTP)
	if accessResponse.Code != http.StatusUnauthorized || opens.Load() != 0 {
		t.Fatalf("access status=%d opens=%d", accessResponse.Code, opens.Load())
	}
	if strings.Contains(accessResponse.Body.String(), "do-not-log") || strings.Contains(accessResponse.Body.String(), "also-secret") {
		t.Fatal("response included cookie material")
	}

	mixedRequest := signedRequest(key, now, "probe-mixed")
	mixedHTTP := httptest.NewRequest(http.MethodPost, Path, strings.NewReader(string(mixedRequest.body)))
	copyHeaders(mixedHTTP, mixedRequest.header)
	mixedHTTP.Header.Set("Cookie", "CF_Authorization=do-not-log; session=also-secret")
	mixedResponse := httptest.NewRecorder()
	handler.ServeHTTP(mixedResponse, mixedHTTP)
	if mixedResponse.Code != http.StatusUnauthorized || opens.Load() != 0 {
		t.Fatalf("mixed status=%d opens=%d", mixedResponse.Code, opens.Load())
	}
	if strings.Contains(mixedResponse.Body.String(), "do-not-log") || strings.Contains(mixedResponse.Body.String(), "also-secret") {
		t.Fatal("response included cookie material")
	}
}

func TestIngressRejectsMalformedCookieWithoutEchoingValue(t *testing.T) {
	request := httptest.NewRequest(http.MethodPost, Path, strings.NewReader(`{"request_id":"probe-malformed"}`))
	request.Header.Set(HeaderRequestID, "probe-malformed")
	request.Header.Set("Cookie", "=do-not-log")
	response := httptest.NewRecorder()
	(&Handler{}).ServeHTTP(response, request)
	if response.Code != http.StatusUnauthorized {
		t.Fatalf("status=%d", response.Code)
	}
	if strings.Contains(response.Body.String(), "do-not-log") {
		t.Fatal("response included cookie material")
	}
}
