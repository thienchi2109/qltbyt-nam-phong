package qltbyt

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"strings"
	"time"

	"example.com/shared-ai-service/internal/protocol"
)

var errCredential = protocol.NewError(401, protocol.CodeUnauthorized, "The request is not authorized.", false)

// Credential is the BFF-signed broker envelope. It is not a browser cookie
// and it is not a project-wide database signing secret.
type Credential struct {
	Issuer              string
	Audience            string
	IssuedAt            time.Time
	ExpiresAt           time.Time
	UserID              int64
	RawRole             string
	SessionFacilityID   *int64
	RequestedFacilityID *int64
	ReservationID       string
}

type credentialPayload struct {
	Issuer              string `json:"iss"`
	Audience            string `json:"aud"`
	IssuedAt            int64  `json:"iat"`
	ExpiresAt           int64  `json:"exp"`
	UserID              int64  `json:"user_id"`
	RawRole             string `json:"role,omitempty"`
	SessionFacilityID   *int64 `json:"session_facility_id,omitempty"`
	RequestedFacilityID *int64 `json:"requested_facility_id,omitempty"`
	ReservationID       string `json:"reservation_id,omitempty"`
	BrowserCookie       string `json:"browser_cookie,omitempty"`
}

// Mint signs a broker credential. Tests and the BFF use the same encoding.
func Mint(secret []byte, cred Credential) (string, error) {
	if len(secret) == 0 {
		return "", errCredential
	}
	payload := credentialPayload{
		Issuer:              cred.Issuer,
		Audience:            cred.Audience,
		IssuedAt:            cred.IssuedAt.Unix(),
		ExpiresAt:           cred.ExpiresAt.Unix(),
		UserID:              cred.UserID,
		RawRole:             cred.RawRole,
		SessionFacilityID:   cred.SessionFacilityID,
		RequestedFacilityID: cred.RequestedFacilityID,
		ReservationID:       cred.ReservationID,
	}
	return signPayload(secret, payload)
}

func signPayload(secret []byte, payload credentialPayload) (string, error) {
	body, err := json.Marshal(payload)
	if err != nil {
		return "", err
	}
	mac := hmac.New(sha256.New, secret)
	_, _ = mac.Write(body)
	return base64.RawURLEncoding.EncodeToString(body) + "." + base64.RawURLEncoding.EncodeToString(mac.Sum(nil)), nil
}

func parseCredential(secret []byte, token string, now time.Time) (Credential, error) {
	if len(secret) == 0 || strings.TrimSpace(token) == "" {
		return Credential{}, errCredential
	}
	encoded, signature, ok := strings.Cut(token, ".")
	if !ok || encoded == "" || signature == "" {
		return Credential{}, errCredential
	}
	body, err := base64.RawURLEncoding.DecodeString(encoded)
	if err != nil {
		return Credential{}, errCredential
	}
	mac := hmac.New(sha256.New, secret)
	_, _ = mac.Write(body)
	expected := base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
	if !hmac.Equal([]byte(expected), []byte(signature)) {
		return Credential{}, errCredential
	}
	var payload credentialPayload
	if err := json.Unmarshal(body, &payload); err != nil {
		return Credential{}, errCredential
	}
	if payload.BrowserCookie != "" {
		return Credential{}, errCredential
	}
	cred := Credential{
		Issuer:              payload.Issuer,
		Audience:            payload.Audience,
		IssuedAt:            time.Unix(payload.IssuedAt, 0).UTC(),
		ExpiresAt:           time.Unix(payload.ExpiresAt, 0).UTC(),
		UserID:              payload.UserID,
		RawRole:             payload.RawRole,
		SessionFacilityID:   payload.SessionFacilityID,
		RequestedFacilityID: payload.RequestedFacilityID,
		ReservationID:       payload.ReservationID,
	}
	if err := validateCredential(cred, now); err != nil {
		return Credential{}, err
	}
	return cred, nil
}

func validateCredential(cred Credential, now time.Time) error {
	if cred.Issuer != BrokerIssuer || cred.Audience != BrokerAudience {
		return errCredential
	}
	if cred.UserID <= 0 {
		return errCredential
	}
	lifetime := cred.ExpiresAt.Sub(cred.IssuedAt)
	if lifetime <= 0 || lifetime > BrokerMaxTTL {
		return errCredential
	}
	if cred.IssuedAt.After(now) || !cred.ExpiresAt.After(now) {
		return errCredential
	}
	return nil
}

func tokenFromRequest(request protocol.Request) string {
	if request.Identity.CapabilityClaims == nil {
		return ""
	}
	value, ok := request.Identity.CapabilityClaims["broker_token"]
	if !ok {
		return ""
	}
	token, ok := value.(string)
	if !ok {
		return ""
	}
	return token
}

func displayName(request protocol.Request) string {
	if request.Context == nil {
		return ""
	}
	value, ok := request.Context["selected_facility_name"]
	if !ok {
		return ""
	}
	text, ok := value.(string)
	if !ok {
		return ""
	}
	return text
}

// SignBrowserCookieToken builds a signed payload that still carries a browser
// cookie claim, so tests can prove the verifier rejects it.
func SignBrowserCookieToken(secret []byte, cred Credential, cookie string) (string, error) {
	if len(secret) == 0 {
		return "", errors.New("missing secret")
	}
	payload := credentialPayload{
		Issuer:              cred.Issuer,
		Audience:            cred.Audience,
		IssuedAt:            cred.IssuedAt.Unix(),
		ExpiresAt:           cred.ExpiresAt.Unix(),
		UserID:              cred.UserID,
		RawRole:             cred.RawRole,
		SessionFacilityID:   cred.SessionFacilityID,
		RequestedFacilityID: cred.RequestedFacilityID,
		BrowserCookie:       cookie,
	}
	return signPayload(secret, payload)
}
