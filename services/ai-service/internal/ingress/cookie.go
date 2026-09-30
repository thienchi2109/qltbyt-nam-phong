package ingress

import (
	"net/http"
	"strings"
)

// accessInfrastructureCookies are appended by Cloudflare Access when it
// forwards an authenticated request to the origin. They are not a browser
// session and they are not authority for this service.
var accessInfrastructureCookies = map[string]struct{}{
	"cf_authorization": {},
	"cf_appsession":    {},
}

// rejectUntrustedCookie reports whether the request carries a browser cookie.
// Access infrastructure cookies are removed and the signed envelope is still
// required. Any other cookie, including a browser session, is rejected.
func rejectUntrustedCookie(r *http.Request) bool {
	if r == nil {
		return false
	}
	raw := r.Header.Get("Cookie")
	if raw == "" {
		return false
	}
	names := cookieHeaderNames(raw)
	if len(names) == 0 {
		return true
	}
	for _, name := range names {
		if _, ok := accessInfrastructureCookies[strings.ToLower(name)]; !ok {
			return true
		}
	}
	r.Header.Del("Cookie")
	return false
}

func cookieHeaderNames(header string) []string {
	parts := strings.Split(header, ";")
	names := make([]string, 0, len(parts))
	seen := make(map[string]struct{}, len(parts))
	for _, part := range parts {
		part = strings.TrimSpace(part)
		if part == "" {
			continue
		}
		name, _, _ := strings.Cut(part, "=")
		name = strings.TrimSpace(name)
		if name == "" {
			return nil
		}
		if _, ok := seen[name]; ok {
			continue
		}
		seen[name] = struct{}{}
		names = append(names, name)
	}
	return names
}
