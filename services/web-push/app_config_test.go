package webpush

import (
	"bytes"
	"encoding/base64"
	"errors"
	"testing"
)

func appTestConfig(t *testing.T, id, origin string, scalar byte) AppConfig {
	t.Helper()
	raw := make([]byte, 32)
	raw[31] = scalar
	path := writeVAPIDSecret(t, raw)
	key, err := LoadVAPIDKey(path, "staging-20260910-01", "", "")
	if err != nil {
		t.Fatal(err)
	}
	return AppConfig{
		ID: id, Origin: origin, WorkerID: "same-local-worker",
		HMACKeyID: "same-local-slot", HMACSecret: base64.StdEncoding.EncodeToString(bytes.Repeat([]byte{scalar}, 32)),
		VAPIDVersion: key.Version, VAPIDPublicKey: key.PublicKey, VAPIDFingerprint: key.Fingerprint,
		VAPIDPath: path, VAPIDSubject: "mailto:" + id + "@example.test",
	}
}

func TestAppBindingsRejectAmbiguousBindings(t *testing.T) {
	a := appTestConfig(t, "app-a", "https://app-a.example", 1)
	b := appTestConfig(t, "app-b", "https://app-b.example", 2)
	for _, tc := range []struct {
		name string
		edit func(*AppConfig)
	}{
		{"duplicate app identity", func(c *AppConfig) { c.ID = a.ID }},
		{"shared source origin", func(c *AppConfig) { c.Origin = a.Origin }},
		{"equivalent source origin", func(c *AppConfig) { c.Origin = "https://APP-A.example:443/" }},
		{"equivalent padded source port", func(c *AppConfig) { c.Origin = "https://APP-A.example:0443/" }},
		{"same decoded credential", func(c *AppConfig) {
			c.HMACKeyID = "different-slot"
			c.HMACSecret = base64.RawURLEncoding.EncodeToString(bytes.Repeat([]byte{1}, 32))
		}},
		{"same VAPID material", func(c *AppConfig) {
			c.VAPIDPath, c.VAPIDPublicKey, c.VAPIDFingerprint = a.VAPIDPath, a.VAPIDPublicKey, a.VAPIDFingerprint
			c.VAPIDVersion = "different-local-version"
		}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			other := b
			tc.edit(&other)
			bindings, err := NewAppBindings([]AppConfig{a, other}, nil)
			if err == nil || bindings != nil {
				t.Fatal("ambiguous configuration exposed usable app bindings")
			}
		})
	}
}

func TestAppBindingsRejectIncompleteOrMismatchedConfiguration(t *testing.T) {
	a := appTestConfig(t, "app-a", "https://app-a.example", 1)
	b := appTestConfig(t, "app-b", "https://app-b.example", 2)
	for _, tc := range []struct {
		name string
		edit func(*AppConfig)
	}{
		{"identity", func(c *AppConfig) { c.ID = "" }},
		{"origin", func(c *AppConfig) { c.Origin = "" }},
		{"missing source hostname", func(c *AppConfig) { c.Origin = "https://:443" }},
		{"out of range source port", func(c *AppConfig) { c.Origin = "https://app-b.example:65536" }},
		{"zero source port", func(c *AppConfig) { c.Origin = "https://app-b.example:0" }},
		{"credential slot", func(c *AppConfig) { c.HMACKeyID = "" }},
		{"credential secret", func(c *AppConfig) { c.HMACSecret = "" }},
		{"version", func(c *AppConfig) { c.VAPIDVersion = "" }},
		{"public key", func(c *AppConfig) { c.VAPIDPublicKey = "" }},
		{"fingerprint", func(c *AppConfig) { c.VAPIDFingerprint = "" }},
		{"private key path", func(c *AppConfig) { c.VAPIDPath = "" }},
		{"subject", func(c *AppConfig) { c.VAPIDSubject = "" }},
		{"blank subject", func(c *AppConfig) { c.VAPIDSubject = " \t " }},
		{"worker identity", func(c *AppConfig) { c.WorkerID = "invalid worker" }},
		{"wrong private key", func(c *AppConfig) { c.VAPIDPath = a.VAPIDPath }},
		{"wrong public key", func(c *AppConfig) { c.VAPIDPublicKey = a.VAPIDPublicKey }},
		{"wrong fingerprint", func(c *AppConfig) { c.VAPIDFingerprint = a.VAPIDFingerprint }},
		{"invalid private scalar", func(c *AppConfig) { c.VAPIDPath = writeVAPIDSecret(t, make([]byte, 32)) }},
	} {
		t.Run(tc.name, func(t *testing.T) {
			other := b
			tc.edit(&other)
			bindings, err := NewAppBindings([]AppConfig{a, other}, nil)
			if err == nil || bindings != nil {
				t.Fatal("invalid configuration exposed partial app bindings")
			}
			if tc.name == "wrong private key" && !errors.Is(err, ErrVAPIDMismatch) {
				t.Fatalf("wrong key error = %v, want artifact mismatch", err)
			}
		})
	}
	if bindings, err := NewAppBindings(nil, nil); err == nil || bindings != nil {
		t.Fatal("empty configuration exposed bindings")
	}
}
