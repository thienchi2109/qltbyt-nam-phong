package webpush

import (
	"context"
	"encoding/base64"
	"errors"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	webpushlib "github.com/SherClockHolmes/webpush-go"
)

type WebPushSender struct {
	Subject    string
	HTTPClient webpushlib.HTTPClient
}

func (s WebPushSender) Send(ctx context.Context, delivery Delivery, key VAPIDKey, timeout time.Duration) (ProviderResult, error) {
	payload, err := base64.StdEncoding.DecodeString(delivery.PayloadBase64)
	if err != nil {
		return ProviderResult{}, errors.New("invalid delivery payload")
	}
	response, err := webpushlib.SendNotificationWithContext(ctx, payload, &webpushlib.Subscription{
		Endpoint: delivery.Endpoint,
		Keys: webpushlib.Keys{
			P256dh: delivery.Keys.P256DH,
			Auth:   delivery.Keys.Auth,
		},
	}, &webpushlib.Options{
		Subscriber:      s.Subject,
		TTL:             delivery.TTLSeconds,
		VAPIDPublicKey:  key.PublicKey,
		VAPIDPrivateKey: key.privateKeyEncoded,
		HTTPClient:      providerHTTPClient(s.HTTPClient),
	})
	if err != nil {
		return ProviderResult{}, err
	}
	if response.Body != nil {
		// HTTP status determines the outcome; cleanup errors must not retry an accepted push.
		_, _ = io.Copy(io.Discard, response.Body)
		_ = response.Body.Close()
	}
	return ProviderResult{
		Status:            response.StatusCode,
		Outcome:           outcomeForStatus(response.StatusCode),
		RetryAfterSeconds: parseRetryAfter(response.Header.Get("retry-after"), time.Now()),
	}, nil
}

func providerHTTPClient(client webpushlib.HTTPClient) webpushlib.HTTPClient {
	if client != nil {
		return client
	}
	return &http.Client{CheckRedirect: func(*http.Request, []*http.Request) error {
		return http.ErrUseLastResponse
	}}
}

func parseRetryAfter(value string, now time.Time) *int {
	value = strings.TrimSpace(value)
	if seconds, err := strconv.Atoi(value); err == nil && seconds >= 0 {
		return &seconds
	}
	if timestamp, err := http.ParseTime(value); err == nil {
		seconds := int(timestamp.Sub(now).Seconds())
		if seconds < 0 {
			seconds = 0
		}
		return &seconds
	}
	return nil
}
