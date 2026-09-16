package webpush

import (
	"context"
	"crypto/tls"
	"encoding/base64"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/netip"
	"net/url"
	"strconv"
	"strings"
	"time"

	webpushlib "github.com/SherClockHolmes/webpush-go"
)

const (
	maxProviderEndpointBytes = 2048
	maxProviderPayloadBytes  = 3072
	maxProviderPayloadBase64 = 4096
	maxProviderTTLSeconds    = 86400
)

var errUnsafeProviderEndpoint = errors.New("unsafe provider endpoint")

type WebPushSender struct {
	Subject     string
	HTTPClient  *http.Client
	httpClient  webpushlib.HTTPClient // package-private seam for response-only tests
	resolve     func(context.Context, string) ([]netip.Addr, error)
	dialContext func(context.Context, string, string) (net.Conn, error)
}

func (s WebPushSender) Send(ctx context.Context, delivery Delivery, key VAPIDKey, timeout time.Duration) (ProviderResult, error) {
	endpoint, err := validateProviderEndpoint(delivery.Endpoint)
	if err != nil {
		return ProviderResult{Outcome: "unsafe_endpoint"}, nil
	}
	if len(delivery.PayloadBase64) > maxProviderPayloadBase64 {
		return ProviderResult{Outcome: "permanent"}, nil
	}
	payload, err := base64.StdEncoding.DecodeString(delivery.PayloadBase64)
	if err != nil || len(payload) > maxProviderPayloadBytes || delivery.TTLSeconds < 1 || delivery.TTLSeconds > maxProviderTTLSeconds {
		return ProviderResult{Outcome: "permanent"}, nil
	}
	if timeout <= 0 {
		timeout = providerTimeout
	} else if timeout > providerTimeout {
		timeout = providerTimeout
	}
	requestContext, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()
	validatedIP, err := resolveProviderEndpoint(requestContext, endpoint, s.resolve)
	if err != nil {
		if errors.Is(err, errUnsafeProviderEndpoint) {
			return ProviderResult{Outcome: "unsafe_endpoint"}, nil
		}
		if isProviderTimeout(err) {
			return ProviderResult{Outcome: "transient"}, nil
		}
		return ProviderResult{}, err
	}
	response, err := webpushlib.SendNotificationWithContext(requestContext, payload, &webpushlib.Subscription{
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
		RecordSize:      webpushlib.MaxRecordSize,
		HTTPClient:      s.providerHTTPClient(endpoint, validatedIP, timeout),
	})
	if err != nil {
		if errors.Is(err, errUnsafeProviderEndpoint) {
			return ProviderResult{Outcome: "unsafe_endpoint"}, nil
		}
		if isProviderTimeout(err) {
			return ProviderResult{Outcome: "transient"}, nil
		}
		return ProviderResult{}, err
	}
	if response == nil {
		return ProviderResult{}, errors.New("provider response is missing")
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

func (s WebPushSender) providerHTTPClient(endpoint *url.URL, validatedIP net.IP, timeout time.Duration) webpushlib.HTTPClient {
	if client := s.HTTPClient; client != nil {
		clientCopy := *client
		clientCopy.CheckRedirect = rejectProviderRedirect
		base := baseProviderTransport()
		if transport, ok := client.Transport.(*http.Transport); ok {
			if transport.TLSClientConfig != nil {
				base.TLSClientConfig = transport.TLSClientConfig.Clone()
			}
		}
		clientCopy.Transport = providerTransport(endpoint.Hostname(), validatedIP, base, s.dialContext)
		if clientCopy.Timeout == 0 || clientCopy.Timeout > timeout {
			clientCopy.Timeout = timeout
		}
		return &clientCopy
	}
	if s.httpClient != nil {
		return s.httpClient
	}
	return &http.Client{
		Timeout:       timeout,
		Transport:     providerTransport(endpoint.Hostname(), validatedIP, baseProviderTransport(), s.dialContext),
		CheckRedirect: rejectProviderRedirect,
	}
}

func rejectProviderRedirect(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }

func baseProviderTransport() *http.Transport {
	transport, ok := http.DefaultTransport.(*http.Transport)
	if !ok {
		return &http.Transport{Proxy: nil}
	}
	clone := transport.Clone()
	clone.Proxy = nil
	return clone
}

func providerTransport(host string, validatedIP net.IP, base *http.Transport, dialContext func(context.Context, string, string) (net.Conn, error)) *http.Transport {
	transport := base.Clone()
	transport.Proxy = nil
	transport.DisableKeepAlives = true
	if dialContext == nil {
		dialer := &net.Dialer{}
		dialContext = dialer.DialContext
	}
	transport.DialContext = func(ctx context.Context, network, address string) (net.Conn, error) {
		_, port, err := net.SplitHostPort(address)
		if err != nil {
			return nil, err
		}
		return dialContext(ctx, network, net.JoinHostPort(validatedIP.String(), port))
	}
	if transport.TLSClientConfig == nil {
		transport.TLSClientConfig = &tls.Config{ServerName: host}
	} else {
		transport.TLSClientConfig = transport.TLSClientConfig.Clone()
		transport.TLSClientConfig.ServerName = host
	}
	return transport
}

func validateProviderEndpoint(raw string) (*url.URL, error) {
	if len(raw) > maxProviderEndpointBytes {
		return nil, fmt.Errorf("%w: endpoint exceeds %d bytes", errUnsafeProviderEndpoint, maxProviderEndpointBytes)
	}
	parsed, err := url.Parse(raw)
	if err != nil || parsed.Scheme != "https" || parsed.Host == "" || parsed.Hostname() == "" || strings.Contains(parsed.Hostname(), "%") || parsed.User != nil || parsed.Fragment != "" || parsed.Opaque != "" {
		return nil, fmt.Errorf("%w: endpoint must be an HTTPS URL", errUnsafeProviderEndpoint)
	}
	if strings.HasSuffix(parsed.Host, ":") || (parsed.Port() != "" && parsed.Port() != "443") {
		return nil, fmt.Errorf("%w: endpoint port must be 443", errUnsafeProviderEndpoint)
	}
	if ip := net.ParseIP(parsed.Hostname()); ip != nil {
		if strings.Contains(parsed.Hostname(), ":") {
			if isIPv4Mapped(ip) || !isPublicProviderIP(ip) {
				return nil, fmt.Errorf("%w: endpoint IP is not public", errUnsafeProviderEndpoint)
			}
		} else if !isPublicProviderIP(ip.To4()) {
			return nil, fmt.Errorf("%w: endpoint IP is not public", errUnsafeProviderEndpoint)
		}
	}
	return parsed, nil
}

func lookupProviderIPs(ctx context.Context, host string) ([]netip.Addr, error) {
	addresses, err := net.DefaultResolver.LookupHost(ctx, host)
	if err != nil {
		return nil, err
	}
	return parseProviderIPAddresses(addresses)
}

func parseProviderIPAddresses(addresses []string) ([]netip.Addr, error) {
	addrs := make([]netip.Addr, 0, len(addresses))
	for _, address := range addresses {
		addr, err := netip.ParseAddr(address)
		if err != nil || addr.Zone() != "" {
			return nil, fmt.Errorf("%w: DNS returned an invalid address", errUnsafeProviderEndpoint)
		}
		addrs = append(addrs, addr)
	}
	return addrs, nil
}

func resolveProviderEndpoint(ctx context.Context, endpoint *url.URL, resolve func(context.Context, string) ([]netip.Addr, error)) (net.IP, error) {
	if ip := net.ParseIP(endpoint.Hostname()); ip != nil {
		if strings.Contains(endpoint.Hostname(), ":") {
			if isIPv4Mapped(ip) || !isPublicProviderIP(ip) {
				return nil, fmt.Errorf("%w: endpoint IP is not public", errUnsafeProviderEndpoint)
			}
		} else if !isPublicProviderIP(ip.To4()) {
			return nil, fmt.Errorf("%w: endpoint IP is not public", errUnsafeProviderEndpoint)
		}
		if ipv4 := ip.To4(); ipv4 != nil {
			return append(net.IP(nil), ipv4...), nil
		}
		return append(net.IP(nil), ip...), nil
	}
	if resolve == nil {
		resolve = lookupProviderIPs
	}
	return resolveProviderIP(ctx, endpoint.Hostname(), resolve)
}

func resolveProviderIP(ctx context.Context, host string, resolve func(context.Context, string) ([]netip.Addr, error)) (net.IP, error) {
	addresses, err := resolve(ctx, host)
	if err != nil {
		return nil, err
	}
	if len(addresses) == 0 {
		return nil, fmt.Errorf("%w: DNS returned no addresses", errUnsafeProviderEndpoint)
	}
	for _, address := range addresses {
		if !isPublicProviderAddr(address) {
			return nil, fmt.Errorf("%w: DNS returned a non-public address", errUnsafeProviderEndpoint)
		}
	}
	return append(net.IP(nil), addresses[0].AsSlice()...), nil
}

func isPublicProviderIP(ip net.IP) bool {
	if ip == nil {
		return false
	}
	addr, ok := netip.AddrFromSlice(ip)
	return ok && isPublicProviderAddr(addr)
}

func isPublicProviderAddr(addr netip.Addr) bool {
	if !addr.IsValid() || addr.Zone() != "" || addr.Is4In6() || !addr.IsGlobalUnicast() {
		return false
	}
	// IANA assigns these two globally reachable anycast addresses within 192.0.0.0/24.
	if addr == netip.AddrFrom4([4]byte{192, 0, 0, 9}) || addr == netip.AddrFrom4([4]byte{192, 0, 0, 10}) {
		return true
	}
	for _, prefix := range providerNonPublicPrefixes {
		if prefix.Contains(addr) {
			return false
		}
	}
	return true
}

func isIPv4Mapped(ip net.IP) bool {
	return len(ip) == net.IPv6len && ip.To4() != nil
}

// IsGlobalUnicast includes special-use ranges that are not safe provider destinations.
var providerNonPublicPrefixes = [...]netip.Prefix{
	netip.MustParsePrefix("0.0.0.0/8"),
	netip.MustParsePrefix("10.0.0.0/8"),
	netip.MustParsePrefix("100.64.0.0/10"),
	netip.MustParsePrefix("127.0.0.0/8"),
	netip.MustParsePrefix("169.254.0.0/16"),
	netip.MustParsePrefix("172.16.0.0/12"),
	netip.MustParsePrefix("192.0.0.0/24"),
	netip.MustParsePrefix("192.0.2.0/24"),
	netip.MustParsePrefix("192.88.99.0/24"),
	netip.MustParsePrefix("192.168.0.0/16"),
	netip.MustParsePrefix("198.18.0.0/15"),
	netip.MustParsePrefix("198.51.100.0/24"),
	netip.MustParsePrefix("203.0.113.0/24"),
	netip.MustParsePrefix("240.0.0.0/4"),
	netip.MustParsePrefix("::/128"),
	netip.MustParsePrefix("::1/128"),
	netip.MustParsePrefix("::/96"),
	netip.MustParsePrefix("::ffff:0:0/96"),
	netip.MustParsePrefix("64:ff9b:1::/48"),
	netip.MustParsePrefix("100::/64"),
	netip.MustParsePrefix("100:0:0:1::/64"),
	netip.MustParsePrefix("2001::/32"),
	netip.MustParsePrefix("2001:2::/48"),
	netip.MustParsePrefix("2001:10::/28"),
	netip.MustParsePrefix("2001:db8::/32"),
	netip.MustParsePrefix("2002::/16"),
	netip.MustParsePrefix("3fff::/20"),
	netip.MustParsePrefix("3ffe::/16"),
	netip.MustParsePrefix("5f00::/16"),
	netip.MustParsePrefix("fc00::/7"),
	netip.MustParsePrefix("fe80::/10"),
	netip.MustParsePrefix("fec0::/10"),
}

func isProviderTimeout(err error) bool {
	if errors.Is(err, context.DeadlineExceeded) {
		return true
	}
	var netErr net.Error
	return errors.As(err, &netErr) && netErr.Timeout()
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
