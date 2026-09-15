package webpush

import (
	"crypto/elliptic"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"fmt"
	"math/big"
	"os"
	"regexp"
	"strings"
)

var (
	ErrVAPIDMismatch = errors.New("vapid artifact mismatch")
	ErrVAPIDNotReady = errors.New("vapid key is not ready")
)

var vapidVersionPattern = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$`)

// VAPIDKey is the process-local representation of the mounted private key.
// PrivateKey is retained only in memory; it is never included in logs or reports.
type VAPIDKey struct {
	Version           string
	PublicKey         string
	Fingerprint       string
	privateKey        []byte
	privateKeyEncoded string
}

// LoadVAPIDKey reads the base64url encoded P-256 scalar from the mounted secret.
// expectedPublicKey and expectedFingerprint are the app-owned public artifact.
func LoadVAPIDKey(path, version, expectedPublicKey, expectedFingerprint string) (VAPIDKey, error) {
	if !vapidVersionPattern.MatchString(version) {
		return VAPIDKey{}, fmt.Errorf("%w: invalid version", ErrVAPIDNotReady)
	}
	encoded, err := os.ReadFile(path)
	if err != nil {
		return VAPIDKey{}, fmt.Errorf("%w: private key unavailable", ErrVAPIDNotReady)
	}
	raw, err := decodeVAPIDPrivateKey(strings.TrimSpace(string(encoded)))
	if err != nil {
		return VAPIDKey{}, fmt.Errorf("%w: invalid private key", ErrVAPIDNotReady)
	}
	publicKey, fingerprint, err := deriveVAPIDArtifact(raw)
	if err != nil {
		return VAPIDKey{}, fmt.Errorf("%w: private key is not a P-256 scalar", ErrVAPIDNotReady)
	}
	if (expectedPublicKey != "" && expectedPublicKey != publicKey) ||
		(expectedFingerprint != "" && expectedFingerprint != fingerprint) {
		return VAPIDKey{}, fmt.Errorf("%w: public artifact mismatch", ErrVAPIDMismatch)
	}
	return VAPIDKey{
		Version:           version,
		PublicKey:         publicKey,
		Fingerprint:       fingerprint,
		privateKey:        append([]byte(nil), raw...),
		privateKeyEncoded: base64.RawURLEncoding.EncodeToString(raw),
	}, nil
}

func deriveVAPIDArtifact(raw []byte) (string, string, error) {
	curve := elliptic.P256()
	scalar := new(big.Int).SetBytes(raw)
	if len(raw) != 32 || scalar.Sign() <= 0 || scalar.Cmp(curve.Params().N) >= 0 {
		return "", "", errors.New("invalid P-256 scalar")
	}
	x, y := curve.ScalarBaseMult(raw)
	point := elliptic.Marshal(curve, x, y)
	publicKey := base64.RawURLEncoding.EncodeToString(point)
	fingerprint := "sha256:" + fmt.Sprintf("%x", sha256.Sum256(point))
	return publicKey, fingerprint, nil
}

func decodeVAPIDPrivateKey(value string) ([]byte, error) {
	decoders := []*base64.Encoding{
		base64.RawURLEncoding,
		base64.URLEncoding,
		base64.RawStdEncoding,
		base64.StdEncoding,
	}
	for _, decoder := range decoders {
		if decoded, err := decoder.DecodeString(value); err == nil {
			return decoded, nil
		}
	}
	return nil, errors.New("invalid base64")
}
