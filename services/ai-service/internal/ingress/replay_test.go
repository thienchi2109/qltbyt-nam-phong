package ingress

import (
	"net/http"
	"testing"
	"time"
)

func TestReplayGuardQuarantineCapacityAndReclaim(t *testing.T) {
	started := time.Unix(1_700_000_000, 0).UTC()
	key := Key{ID: "key-1", Secret: []byte("secret-1"), Issuer: "nextjs-bff", Audience: "ai-service-v1", AppID: "second-app", CapabilityID: "inventory-note"}
	guard := NewReplayGuard(started, []Key{key})
	now := started.Add(Quarantine)
	if guard.Ready(now.Add(-time.Nanosecond)) {
		t.Fatal("ready during quarantine")
	}
	early := signedRequest(key, now, "early")
	if _, err := guard.Authenticate(now.Add(-time.Nanosecond), early.header, early.body); err != ErrNotReady {
		t.Fatalf("quarantine = %v", err)
	}
	if _, err := guard.Authenticate(now, early.header, early.body); err != nil {
		t.Fatal(err)
	}
	if err := guard.Admit(now, mustAuth(t, guard, now, early)); err != nil {
		t.Fatal(err)
	}
	if err := guard.Admit(now, mustAuth(t, guard, now, early)); err != ErrReplay {
		t.Fatalf("replay = %v", err)
	}
	if !guard.Contains("early") {
		t.Fatal("live nonce missing")
	}
	tampered := signedRequest(key, now, "tampered")
	tampered.body = []byte(`{"protocol_version":"v1","messages":[]}`)
	if _, err := guard.Authenticate(now, tampered.header, tampered.body); err != ErrUnauthenticated {
		t.Fatalf("tamper = %v", err)
	}
	old := signedRequest(key, now.Add(-ReplayWindow-time.Second), "old")
	if _, err := guard.Authenticate(now, old.header, old.body); err != ErrUnauthenticated {
		t.Fatalf("old = %v", err)
	}
	future := signedRequest(key, now.Add(ClockSkew+time.Second), "future")
	if _, err := guard.Authenticate(now, future.header, future.body); err != ErrUnauthenticated {
		t.Fatalf("future = %v", err)
	}
	for index := 0; index < NonceCapacity-1; index++ {
		request := signedRequest(key, now, "n"+itoa(index))
		if err := guard.Admit(now, mustAuth(t, guard, now, request)); err != nil {
			t.Fatalf("fill %d: %v", index, err)
		}
	}
	overflow := signedRequest(key, now, "overflow")
	if err := guard.Admit(now, mustAuth(t, guard, now, overflow)); err != ErrCapacity {
		t.Fatalf("capacity = %v", err)
	}
	if !guard.Contains("early") {
		t.Fatal("capacity evicted a live nonce")
	}
	later := now.Add(ReplayWindow + time.Second)
	reclaimed := signedRequest(key, later, "after-reclaim")
	if err := guard.Admit(later, mustAuth(t, guard, later, reclaimed)); err != nil {
		t.Fatal(err)
	}
	if guard.Contains("early") {
		t.Fatal("expired nonce was not reclaimed")
	}
	if !guard.Contains("after-reclaim") {
		t.Fatal("new nonce missing")
	}
}

func TestSharedHMACVector(t *testing.T) {
	signature := Sign([]byte(VectorSecret), VectorTimestamp, VectorRequestID, VectorKeyID, []byte(VectorBody))
	if signature != VectorSignature {
		t.Fatalf("signature = %s", signature)
	}
}

type signed struct {
	header http.Header
	body   []byte
}

func signedRequest(key Key, timestamp time.Time, requestID string) signed {
	body := []byte(`{"protocol_version":"v1","app_id":"` + key.AppID + `","capability_id":"` + key.CapabilityID + `","capability_version":"v1","request_id":"` + requestID + `","identity":{"issuer":"` + key.Issuer + `","audience":"` + key.Audience + `"},"messages":[{"role":"user","content":"hello"}]}`)
	text := itoa(int(timestamp.Unix()))
	header := make(http.Header)
	header.Set(HeaderTimestamp, text)
	header.Set(HeaderRequestID, requestID)
	header.Set(HeaderKeyID, key.ID)
	header.Set(HeaderSignature, Sign(key.Secret, text, requestID, key.ID, body))
	return signed{header: header, body: body}
}

func mustAuth(t *testing.T, guard *ReplayGuard, now time.Time, request signed) Authenticated {
	t.Helper()
	authenticated, err := guard.Authenticate(now, request.header, request.body)
	if err != nil {
		t.Fatal(err)
	}
	return authenticated
}

func itoa(value int) string {
	if value == 0 {
		return "0"
	}
	negative := value < 0
	if negative {
		value = -value
	}
	var digits [20]byte
	index := len(digits)
	for value > 0 {
		index--
		digits[index] = byte('0' + value%10)
		value /= 10
	}
	if negative {
		index--
		digits[index] = '-'
	}
	return string(digits[index:])
}
