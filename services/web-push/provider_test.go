package webpush

import (
	"context"
	"encoding/base64"
	"errors"
	"io"
	"net/http"
	"net/netip"
	"testing"
	"time"
)

type providerResponseClient struct{ body io.ReadCloser }

func (c providerResponseClient) Do(*http.Request) (*http.Response, error) {
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
