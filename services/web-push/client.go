package webpush

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"regexp"
	"strconv"
	"strings"
	"time"
)

const (
	claimPath         = "/api/internal/web-push/v1/claim"
	reportPath        = "/api/internal/web-push/v1/report"
	maxClaimResponse  = 48 << 10
	maxReportResponse = 8 << 10
)

var workerKeyIDPattern = regexp.MustCompile(`^[a-z0-9-]{1,64}$`)

var ErrUnsupportedVersion = errors.New("unsupported worker API version")

type apiErrorEnvelope struct {
	Version *int          `json:"version"`
	Error   *apiErrorBody `json:"error"`
}

type apiErrorBody struct {
	Code              string `json:"code"`
	RetryAfterSeconds *int   `json:"retry_after_seconds"`
}

type APIError struct {
	Status            int
	Code              string
	RetryAfterSeconds *int
	Err               error
}

func (e *APIError) Error() string {
	if e.Code != "" {
		return fmt.Sprintf("web push API %d %s", e.Status, e.Code)
	}
	if e.Err != nil {
		return fmt.Sprintf("web push API %d: %v", e.Status, e.Err)
	}
	return fmt.Sprintf("web push API %d", e.Status)
}

func (e *APIError) Unwrap() error { return e.Err }

type HTTPBackend struct {
	origin string
	keyID  string
	secret []byte
	client *http.Client
	clock  func() time.Time
	nonce  func() ([16]byte, error)
}

func NewHTTPBackend(origin, keyID, secretBase64 string, client *http.Client) (*HTTPBackend, error) {
	parsed, err := url.Parse(origin)
	if err != nil || parsed.Scheme != "https" || parsed.Host == "" || parsed.User != nil || (parsed.Path != "" && parsed.Path != "/") || parsed.RawQuery != "" || parsed.Fragment != "" {
		return nil, errors.New("origin must be an https origin")
	}
	if !workerKeyIDPattern.MatchString(keyID) {
		return nil, errors.New("key id is invalid")
	}
	if client == nil {
		client = &http.Client{Timeout: workerCallTimeout}
	}
	clientCopy := *client
	clientCopy.CheckRedirect = func(*http.Request, []*http.Request) error {
		return http.ErrUseLastResponse
	}
	secret, err := decodeHMACSecret(secretBase64)
	if err != nil {
		return nil, err
	}
	return &HTTPBackend{
		origin: strings.TrimSuffix(origin, "/"),
		keyID:  keyID,
		secret: secret,
		client: &clientCopy,
		clock:  time.Now,
		nonce:  randNonce,
	}, nil
}

func (b *HTTPBackend) Claim(ctx context.Context, request ClaimRequest) (ClaimResponse, error) {
	var response ClaimResponse
	err := b.doJSON(ctx, claimPath, request, &response, maxClaimResponse)
	return response, err
}

func (b *HTTPBackend) Report(ctx context.Context, request ReportRequest) (ReportResponse, error) {
	var response ReportResponse
	err := b.doJSON(ctx, reportPath, request, &response, maxReportResponse)
	return response, err
}

func (b *HTTPBackend) doJSON(ctx context.Context, path string, request, response interface{}, maxResponse int64) error {
	var lastErr error
	for attempt := 0; attempt < 2; attempt++ {
		err := b.doJSONAttempt(ctx, path, request, response, maxResponse)
		var apiErr *APIError
		if attempt == 0 && errors.As(err, &apiErr) && apiErr.Status == http.StatusConflict && apiErr.Code == "replay" {
			lastErr = err
			continue
		}
		return err
	}
	return lastErr
}

func (b *HTTPBackend) doJSONAttempt(ctx context.Context, path string, request, response interface{}, maxResponse int64) (resultErr error) {
	rawBody, err := json.Marshal(request)
	if err != nil {
		return &APIError{Err: err}
	}
	maxRequest := int64(8 << 10)
	if path == claimPath {
		maxRequest = 2 << 10
	}
	if int64(len(rawBody)) > maxRequest {
		return &APIError{Code: "body_too_large"}
	}
	nonce, err := b.nonce()
	if err != nil {
		return &APIError{Err: err}
	}
	timestamp := strconv.FormatInt(b.clock().Unix(), 10)
	nonceHex := hex.EncodeToString(nonce[:])
	signature := signRequest(b.secret, b.keyID, "POST", path, timestamp, nonceHex, rawBody)
	requestContext, cancel := context.WithTimeout(ctx, workerCallTimeout)
	defer cancel()
	req, err := http.NewRequestWithContext(requestContext, http.MethodPost, b.origin+path, bytes.NewReader(rawBody))
	if err != nil {
		return &APIError{Err: err}
	}
	req.Header.Set("content-type", "application/json")
	req.Header.Set("x-web-push-key-id", b.keyID)
	req.Header.Set("x-web-push-timestamp", timestamp)
	req.Header.Set("x-web-push-nonce", nonceHex)
	req.Header.Set("x-web-push-signature", signature)
	res, err := b.client.Do(req)
	if err != nil {
		return &APIError{Err: err}
	}
	defer func() {
		if closeErr := res.Body.Close(); closeErr != nil && resultErr == nil {
			resultErr = &APIError{Status: res.StatusCode, Code: "response_body_close", Err: closeErr}
		}
	}()
	if res.StatusCode < 200 || res.StatusCode > 299 {
		return readAPIError(res)
	}
	data, err := io.ReadAll(io.LimitReader(res.Body, maxResponse+1))
	if err != nil {
		return &APIError{Status: res.StatusCode, Err: err}
	}
	if int64(len(data)) > maxResponse {
		return &APIError{Status: res.StatusCode, Code: "body_too_large"}
	}
	if err := decodeStrictJSON(data, response, ""); err != nil {
		return invalidResponseAPIError(res.StatusCode, err)
	}
	if err := validateResponseVersion(data, ""); err != nil {
		return invalidResponseAPIError(res.StatusCode, err)
	}
	return nil
}

func readAPIError(res *http.Response) error {
	data, err := io.ReadAll(io.LimitReader(res.Body, 4097))
	if err != nil {
		return invalidResponseAPIError(res.StatusCode, err)
	}
	if len(data) > 4096 {
		return invalidResponseAPIError(res.StatusCode, errors.New("response body too large"))
	}
	var envelope apiErrorEnvelope
	if err := decodeStrictJSON(data, &envelope, "$.error.retry_after_seconds"); err != nil {
		return invalidResponseAPIError(res.StatusCode, err)
	}
	if err := validateResponseVersion(data, "$.error.retry_after_seconds"); err != nil {
		return invalidResponseAPIError(res.StatusCode, err)
	}
	if envelope.Error == nil || envelope.Error.Code == "" {
		return invalidResponseAPIError(res.StatusCode, errors.New("error envelope is incomplete"))
	}
	if envelope.Error.RetryAfterSeconds != nil && *envelope.Error.RetryAfterSeconds < 0 {
		return invalidResponseAPIError(res.StatusCode, errors.New("retry_after_seconds must be non-negative"))
	}
	return &APIError{
		Status:            res.StatusCode,
		Code:              envelope.Error.Code,
		RetryAfterSeconds: firstRetryAfter(envelope.Error.RetryAfterSeconds, res.Header.Get("retry-after"), time.Now()),
	}
}

func invalidResponseAPIError(status int, err error) *APIError {
	return &APIError{Status: status, Code: responseErrorCode(err), Err: fmt.Errorf("%w: %v", ErrInvalidResponse, err)}
}

func responseErrorCode(err error) string {
	if errors.Is(err, ErrUnsupportedVersion) {
		return "unsupported_version"
	}
	return "invalid_response"
}

func firstRetryAfter(value *int, header string, now time.Time) *int {
	if value != nil {
		return value
	}
	return parseRetryAfter(header, now)
}

func signRequest(secret []byte, keyID, method, path, timestamp, nonce string, rawBody []byte) string {
	hash := sha256.Sum256(rawBody)
	canonical := strings.Join([]string{"web-push-v1", keyID, method, path, timestamp, nonce, hex.EncodeToString(hash[:])}, "\n")
	mac := hmac.New(sha256.New, secret)
	_, _ = mac.Write([]byte(canonical))
	return hex.EncodeToString(mac.Sum(nil))
}

func decodeHMACSecret(value string) ([]byte, error) {
	for _, encoding := range []*base64.Encoding{base64.StdEncoding, base64.RawStdEncoding, base64.URLEncoding, base64.RawURLEncoding} {
		decoded, err := encoding.DecodeString(value)
		if err == nil && len(decoded) == 32 {
			return decoded, nil
		}
	}
	return nil, errors.New("HMAC secret must decode to 32 bytes")
}

func randNonce() ([16]byte, error) {
	var nonce [16]byte
	_, err := rand.Read(nonce[:])
	return nonce, err
}
