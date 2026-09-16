package webpush

import (
	"context"
	"encoding/base64"
	"errors"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"net/netip"
	"strings"
	"sync/atomic"
	"testing"
	"time"
)

type recordingProviderClient struct {
	calls  int32
	body   []byte
	status int
}

func (c *recordingProviderClient) Do(request *http.Request) (*http.Response, error) {
	atomic.AddInt32(&c.calls, 1)
	c.body, _ = io.ReadAll(request.Body)
	return &http.Response{
		StatusCode: c.status,
		Header:     make(http.Header),
		Body:       io.NopCloser(strings.NewReader("")),
	}, nil
}

func validProviderDelivery(t *testing.T) (Delivery, VAPIDKey) {
	t.Helper()
	key := testVAPIDKey(t)
	delivery := testDelivery()
	delivery.Keys = SubscriptionKeys{
		P256DH: key.PublicKey,
		Auth:   base64.RawURLEncoding.EncodeToString(make([]byte, 16)),
	}
	return delivery, key
}

func TestProviderRejectsUnsafeEndpointBeforeClient(t *testing.T) {
	cases := []string{
		"http://push.example.test/send",
		"https://user:secret@push.example.test/send",
		"https://push.example.test/send#fragment",
		"https:///send",
		"https://127.0.0.1/send",
		"https://10.0.0.1/send",
		"https://100.64.0.1/send",
		"https://198.18.0.1/send",
		"https://192.0.2.1/send",
		"https://[::1]/send",
		"https://[fc00::1]/send",
		"https://[fe80::1]/send",
		"https://[fe80::1%25eth0]/send",
		"https://[ff02::1]/send",
		"https://0.0.0.0/send",
		"https://[::]/send",
		"https://[2001:db8::1]/send",
		"https://[::ffff:127.0.0.1]/send",
		"https://[::ffff:8.8.8.8]/send",
		"https://push.example.test:8443/send",
		"https://" + strings.Repeat("a", 2041) + "/send",
	}
	for _, endpoint := range cases {
		t.Run(endpoint, func(t *testing.T) {
			delivery, key := validProviderDelivery(t)
			delivery.Endpoint = endpoint
			client := &recordingProviderClient{status: http.StatusCreated}
			result, err := (WebPushSender{Subject: "mailto:test@example.test", httpClient: client}).Send(context.Background(), delivery, key, time.Second)
			if err != nil || result.Outcome != "unsafe_endpoint" || result.Status != 0 {
				t.Fatalf("result=%+v err=%v, want unsafe endpoint", result, err)
			}
			if got := atomic.LoadInt32(&client.calls); got != 0 {
				t.Fatalf("client calls = %d, want 0", got)
			}
		})
	}
}

func TestProviderAcceptsPublicIPv6Endpoint(t *testing.T) {
	delivery, key := validProviderDelivery(t)
	delivery.Endpoint = "https://[2001:4860::1]/send"
	client := &recordingProviderClient{status: http.StatusCreated}
	result, err := (WebPushSender{Subject: "mailto:test@example.test", httpClient: client}).Send(context.Background(), delivery, key, time.Second)
	if err != nil || result.Outcome != "accepted" || result.Status != http.StatusCreated {
		t.Fatalf("result=%+v err=%v, want accepted public IPv6 endpoint", result, err)
	}
	if got := atomic.LoadInt32(&client.calls); got != 1 {
		t.Fatalf("client calls = %d, want 1", got)
	}
}

func TestProviderAcceptsPublicIPv6DNSAnswer(t *testing.T) {
	delivery, key := validProviderDelivery(t)
	client := &recordingProviderClient{status: http.StatusCreated}
	sender := WebPushSender{
		Subject:    "mailto:test@example.test",
		httpClient: client,
		resolve: func(context.Context, string) ([]netip.Addr, error) {
			return []netip.Addr{netip.MustParseAddr("2001:4860::1")}, nil
		},
	}
	result, err := sender.Send(context.Background(), delivery, key, time.Second)
	if err != nil || result.Outcome != "accepted" || result.Status != http.StatusCreated {
		t.Fatalf("result=%+v err=%v, want accepted public IPv6 DNS answer", result, err)
	}
	if got := atomic.LoadInt32(&client.calls); got != 1 {
		t.Fatalf("client calls = %d, want 1", got)
	}
}

func TestProviderAcceptsInjectedOrdinaryIPv4DNSAnswer(t *testing.T) {
	delivery, key := validProviderDelivery(t)
	client := &recordingProviderClient{status: http.StatusCreated}
	sender := WebPushSender{
		Subject:    "mailto:test@example.test",
		httpClient: client,
		resolve: func(context.Context, string) ([]netip.Addr, error) {
			return []netip.Addr{netip.MustParseAddr("8.8.8.8")}, nil
		},
	}
	result, err := sender.Send(context.Background(), delivery, key, time.Second)
	if err != nil || result.Outcome != "accepted" || result.Status != http.StatusCreated {
		t.Fatalf("result=%+v err=%v, want accepted ordinary IPv4 DNS answer", result, err)
	}
}

func TestProviderLookupPreservesTextualAddressFamily(t *testing.T) {
	t.Run("IPv4 is canonicalized", func(t *testing.T) {
		ip, err := resolveProviderIP(context.Background(), "8.8.8.8", lookupProviderIPs)
		if err != nil || len(ip) != net.IPv4len || !ip.Equal(net.ParseIP("8.8.8.8")) {
			t.Fatalf("resolved IP = %v (len %d), err=%v; want 4-byte IPv4", ip, len(ip), err)
		}
	})
	t.Run("mapped IPv6 is rejected", func(t *testing.T) {
		_, err := resolveProviderIP(context.Background(), "::ffff:8.8.8.8", lookupProviderIPs)
		if !errors.Is(err, errUnsafeProviderEndpoint) {
			t.Fatalf("err=%v, want unsafe provider endpoint", err)
		}
	})
}

func TestProviderResolvesEverySendAndRejectsUnsafeAnswers(t *testing.T) {
	unsafeIPs := []netip.Addr{
		netip.MustParseAddr("10.0.0.1"),
		netip.MustParseAddr("169.254.1.1"),
		netip.MustParseAddr("100.64.0.1"),
		netip.MustParseAddr("198.18.0.1"),
		netip.MustParseAddr("192.0.2.1"),
		netip.MustParseAddr("2001:db8::1"),
		netip.MustParseAddr("ff02::1"),
		netip.MustParseAddr("::"),
		netip.MustParseAddr("::ffff:8.8.8.8"),
		netip.MustParseAddr("::ffff:192.168.1.1"),
	}
	for _, unsafeIP := range unsafeIPs {
		t.Run(unsafeIP.String(), func(t *testing.T) {
			delivery, key := validProviderDelivery(t)
			var calls int32
			sender := WebPushSender{
				Subject: delivery.Endpoint,
				resolve: func(context.Context, string) ([]netip.Addr, error) {
					atomic.AddInt32(&calls, 1)
					return []netip.Addr{unsafeIP}, nil
				},
				dialContext: func(context.Context, string, string) (net.Conn, error) {
					t.Fatal("dial must not run for an unsafe DNS answer")
					return nil, errors.New("unexpected dial")
				},
			}
			for attempt := 0; attempt < 2; attempt++ {
				result, err := sender.Send(context.Background(), delivery, key, time.Second)
				if err != nil || result.Outcome != "unsafe_endpoint" || result.Status != 0 {
					t.Fatalf("attempt %d: result=%+v err=%v, want unsafe endpoint", attempt, result, err)
				}
			}
			if got := atomic.LoadInt32(&calls); got != 2 {
				t.Fatalf("DNS resolve calls = %d, want 2", got)
			}
		})
	}
}

func TestProviderPinsValidatedIPKeepsHostAndQuery(t *testing.T) {
	var requestHost, requestURI, serverName, dialAddress string
	server := httptest.NewTLSServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		requestHost = request.Host
		requestURI = request.URL.RequestURI()
		serverName = request.TLS.ServerName
		writer.WriteHeader(http.StatusCreated)
	}))
	defer server.Close()

	delivery, key := validProviderDelivery(t)
	delivery.Endpoint = "https://push.example.test/send?token=keep-me"
	publicIP := netip.MustParseAddr("8.8.8.8")
	client := server.Client()
	client.Transport.(*http.Transport).TLSClientConfig.InsecureSkipVerify = true // test server uses a generated certificate.
	sender := WebPushSender{
		Subject:    "mailto:test@example.test",
		HTTPClient: client,
		resolve: func(context.Context, string) ([]netip.Addr, error) {
			return []netip.Addr{publicIP}, nil
		},
		dialContext: func(ctx context.Context, network, address string) (net.Conn, error) {
			dialAddress = address
			return (&net.Dialer{}).DialContext(ctx, network, server.Listener.Addr().String())
		},
	}
	result, err := sender.Send(context.Background(), delivery, key, time.Second)
	if err != nil || result.Outcome != "accepted" {
		t.Fatalf("result=%+v err=%v, want accepted", result, err)
	}
	if dialAddress != "8.8.8.8:443" {
		t.Fatalf("dial address = %q, want pinned public IP", dialAddress)
	}
	if requestHost != "push.example.test" || requestURI != "/send?token=keep-me" || serverName != "push.example.test" {
		t.Fatalf("request host/URI/SNI = %q/%q/%q, want original host/query/SNI", requestHost, requestURI, serverName)
	}
}

func TestProviderRejectsRedirects(t *testing.T) {
	var redirected int32
	target := httptest.NewTLSServer(http.HandlerFunc(func(http.ResponseWriter, *http.Request) {
		atomic.AddInt32(&redirected, 1)
	}))
	defer target.Close()
	server := httptest.NewTLSServer(http.HandlerFunc(func(writer http.ResponseWriter, _ *http.Request) {
		writer.Header().Set("Location", target.URL)
		writer.WriteHeader(http.StatusTemporaryRedirect)
	}))
	defer server.Close()

	delivery, key := validProviderDelivery(t)
	delivery.Endpoint = "https://push.example.test/send"
	client := server.Client()
	client.Transport.(*http.Transport).TLSClientConfig.InsecureSkipVerify = true // test server uses a generated certificate.
	sender := WebPushSender{
		Subject:    "mailto:test@example.test",
		HTTPClient: client,
		resolve: func(context.Context, string) ([]netip.Addr, error) {
			return []netip.Addr{netip.MustParseAddr("8.8.8.8")}, nil
		},
		dialContext: func(ctx context.Context, network, _ string) (net.Conn, error) {
			return (&net.Dialer{}).DialContext(ctx, network, server.Listener.Addr().String())
		},
	}
	result, err := sender.Send(context.Background(), delivery, key, time.Second)
	if err != nil || result.Outcome != "permanent" || result.Status != http.StatusTemporaryRedirect {
		t.Fatalf("result=%+v err=%v, want permanent 307", result, err)
	}
	if got := atomic.LoadInt32(&redirected); got != 0 {
		t.Fatalf("redirect target calls = %d, want 0", got)
	}
}

func TestProviderBoundsPayloadAndTTL(t *testing.T) {
	cases := []struct {
		name       string
		payloadLen int
		ttl        int
		outcome    string
		calls      int32
	}{
		{name: "payload limit accepted", payloadLen: 3072, ttl: 86400, outcome: "accepted", calls: 1},
		{name: "payload too large", payloadLen: 3073, ttl: 60, outcome: "permanent", calls: 0},
		{name: "ttl zero", payloadLen: 1, ttl: 0, outcome: "permanent", calls: 0},
		{name: "ttl too large", payloadLen: 1, ttl: 86401, outcome: "permanent", calls: 0},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			delivery, key := validProviderDelivery(t)
			delivery.PayloadBase64 = base64.StdEncoding.EncodeToString(make([]byte, tc.payloadLen))
			delivery.TTLSeconds = tc.ttl
			client := &recordingProviderClient{status: http.StatusCreated}
			sender := WebPushSender{
				Subject:    "mailto:test@example.test",
				httpClient: client,
				resolve: func(context.Context, string) ([]netip.Addr, error) {
					return []netip.Addr{netip.MustParseAddr("8.8.8.8")}, nil
				},
			}
			result, err := sender.Send(context.Background(), delivery, key, time.Second)
			if err != nil || result.Outcome != tc.outcome {
				t.Fatalf("result=%+v err=%v, want %q", result, err, tc.outcome)
			}
			if got := atomic.LoadInt32(&client.calls); got != tc.calls {
				t.Fatalf("client calls = %d, want %d", got, tc.calls)
			}
			if tc.payloadLen == 3072 && len(client.body) > 4096 {
				t.Fatalf("encrypted body bytes = %d, want <= 4096", len(client.body))
			}
		})
	}
}

func TestProviderOutcomeAndTimeoutMapping(t *testing.T) {
	cases := []struct {
		status  int
		outcome string
	}{
		{http.StatusOK, "accepted"},
		{http.StatusMultipleChoices, "permanent"},
		{http.StatusBadRequest, "permanent"},
		{http.StatusUnauthorized, "credential_error"},
		{http.StatusForbidden, "credential_error"},
		{http.StatusNotFound, "endpoint_gone"},
		{http.StatusRequestTimeout, "transient"},
		{http.StatusGone, "endpoint_gone"},
		{http.StatusRequestEntityTooLarge, "permanent"},
		{http.StatusTooManyRequests, "transient"},
		{http.StatusInternalServerError, "transient"},
		{http.StatusNetworkAuthenticationRequired, "transient"},
		{599, "transient"},
		{600, "permanent"},
	}
	for _, tc := range cases {
		if got := outcomeForStatus(tc.status); got != tc.outcome {
			t.Errorf("status %d outcome = %q, want %q", tc.status, got, tc.outcome)
		}
	}

	delivery, key := validProviderDelivery(t)
	client := timeoutProviderClient{}
	result, err := (WebPushSender{
		Subject:    "mailto:test@example.test",
		httpClient: client,
		resolve: func(context.Context, string) ([]netip.Addr, error) {
			return []netip.Addr{netip.MustParseAddr("8.8.8.8")}, nil
		},
	}).Send(context.Background(), delivery, key, time.Second)
	if err != nil || result.Outcome != "transient" || result.Status != 0 {
		t.Fatalf("timeout result=%+v err=%v, want transient", result, err)
	}
}

type timeoutProviderClient struct{}

func (timeoutProviderClient) Do(*http.Request) (*http.Response, error) {
	return nil, &urlErrorTimeout{}
}

type urlErrorTimeout struct{}

func (*urlErrorTimeout) Error() string   { return "provider timeout" }
func (*urlErrorTimeout) Timeout() bool   { return true }
func (*urlErrorTimeout) Temporary() bool { return true }

var _ net.Error = (*urlErrorTimeout)(nil)

func TestProviderClientDoesNotUseProxyEnvironment(t *testing.T) {
	t.Setenv("HTTPS_PROXY", "https://proxy.invalid:443")
	transport := baseProviderTransport()
	if transport.Proxy != nil {
		t.Fatal("provider transport uses an environment proxy")
	}
}
