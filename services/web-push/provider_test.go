package webpush

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/netip"
	"strings"
	"testing"
	"time"
)

type providerResponseClient struct {
	body          io.ReadCloser
	authorization *string
}

func (c providerResponseClient) Do(request *http.Request) (*http.Response, error) {
	if c.authorization != nil {
		*c.authorization = request.Header.Get("Authorization")
	}
	return &http.Response{StatusCode: http.StatusCreated, Header: make(http.Header), Body: c.body}, nil
}

type failingProviderBody struct {
	readErr bool
	closed  bool
}

func (b *failingProviderBody) Read([]byte) (int, error) {
	if b.readErr {
		return 0, errors.New("read failed")
	}
	return 0, io.EOF
}

func (b *failingProviderBody) Close() error {
	b.closed = true
	return errors.New("close failed")
}

func TestProviderAcceptedSurvivesBodyCleanupFailure(t *testing.T) {
	for _, readErr := range []bool{false, true} {
		key := testVAPIDKey(t)
		delivery := testDelivery()
		delivery.Keys = SubscriptionKeys{P256DH: key.PublicKey, Auth: base64.RawURLEncoding.EncodeToString(make([]byte, 16))}
		body := &failingProviderBody{readErr: readErr}
		sender := WebPushSender{
			Subject:    "mailto:test@example.test",
			httpClient: providerResponseClient{body: body},
			resolve: func(context.Context, string) ([]netip.Addr, error) {
				return []netip.Addr{netip.MustParseAddr("8.8.8.8")}, nil
			},
		}
		result, err := sender.Send(context.Background(), delivery, key, time.Second)
		if err != nil || result.Outcome != "accepted" || result.Status != http.StatusCreated || !body.closed {
			t.Fatalf("accepted response lost: result=%+v err=%v closed=%v", result, err, body.closed)
		}
	}
}

func TestProviderStripsMailtoPrefixForVAPIDSubscriber(t *testing.T) {
	cases := []struct {
		name              string
		configuredSubject string
		expectedSubject   string
	}{
		{name: "configured mailto", configuredSubject: "mailto:test@example.test", expectedSubject: "mailto:test@example.test"},
		{name: "configured https", configuredSubject: "https://example.test/contact", expectedSubject: "https://example.test/contact"},
		{name: "raw email compatibility", configuredSubject: "test@example.test", expectedSubject: "mailto:test@example.test"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			key := testVAPIDKey(t)
			delivery := testDelivery()
			delivery.Keys = SubscriptionKeys{P256DH: key.PublicKey, Auth: base64.RawURLEncoding.EncodeToString(make([]byte, 16))}
			var authorization string
			sender := WebPushSender{
				Subject:    tc.configuredSubject,
				httpClient: providerResponseClient{body: http.NoBody, authorization: &authorization},
				resolve: func(context.Context, string) ([]netip.Addr, error) {
					return []netip.Addr{netip.MustParseAddr("8.8.8.8")}, nil
				},
			}
			result, err := sender.Send(context.Background(), delivery, key, time.Second)
			if err != nil || result.Outcome != "accepted" {
				t.Fatalf("result=%+v err=%v, want accepted", result, err)
			}

			const authorizationPrefix = "vapid t="
			if !strings.HasPrefix(authorization, authorizationPrefix) {
				t.Fatalf("authorization = %q, want VAPID token", authorization)
			}
			token := strings.SplitN(strings.TrimPrefix(authorization, authorizationPrefix), ",", 2)[0]
			segments := strings.Split(token, ".")
			if len(segments) != 3 {
				t.Fatalf("VAPID token segments = %d, want 3", len(segments))
			}
			payload, err := base64.RawURLEncoding.DecodeString(segments[1])
			if err != nil {
				t.Fatalf("decode VAPID claims: %v", err)
			}
			var claims struct {
				Subject string `json:"sub"`
			}
			if err := json.Unmarshal(payload, &claims); err != nil {
				t.Fatalf("decode VAPID claims JSON: %v", err)
			}
			if claims.Subject != tc.expectedSubject {
				t.Fatalf("VAPID subject = %q, want %q", claims.Subject, tc.expectedSubject)
			}
		})
	}
}
