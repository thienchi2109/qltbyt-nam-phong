package webpush

import (
	"bytes"
	"errors"
	"net"
	"net/http"
	"net/url"
	"regexp"
	"strconv"
	"strings"
)

var appIDPattern = regexp.MustCompile(`^[a-z0-9][a-z0-9-]{0,63}$`)

// AppConfig is trusted operator configuration, never request or delivery data.
// ID survives credential rotation; WorkerID and VAPIDVersion are local to the app.
type AppConfig struct {
	ID               string
	Origin           string
	WorkerID         string
	HMACKeyID        string
	HMACSecret       string
	VAPIDVersion     string
	VAPIDPublicKey   string
	VAPIDFingerprint string
	VAPIDPath        string
	VAPIDSubject     string
	Paused           bool
}

// AppBinding owns the worker, backend, key and health state for one app.
// Local delivery/subscription IDs never select a backend or a key.
type AppBinding struct {
	ID     string
	Worker *Worker
	Health *HealthState
}

func ValidateAppID(id string) error {
	if !appIDPattern.MatchString(id) {
		return errors.New("app identity is invalid")
	}
	return nil
}

// NewAppBindings validates the entire set before returning any usable binding.
// This composes workers only; multi-app scheduling belongs to the runtime.
func NewAppBindings(configs []AppConfig, client *http.Client) ([]AppBinding, error) {
	if len(configs) == 0 {
		return nil, errors.New("app configuration is missing")
	}
	bindings := make([]AppBinding, 0, len(configs))
	for _, cfg := range configs {
		if err := ValidateAppID(cfg.ID); err != nil {
			return nil, err
		}
		if cfg.VAPIDVersion == "" || cfg.VAPIDPublicKey == "" || cfg.VAPIDFingerprint == "" || strings.TrimSpace(cfg.VAPIDSubject) == "" {
			return nil, errors.New("app VAPID configuration is missing")
		}
		backend, err := NewHTTPBackend(cfg.Origin, cfg.HMACKeyID, cfg.HMACSecret, client)
		if err != nil {
			return nil, err
		}
		origin, err := canonicalAppOrigin(backend.origin)
		if err != nil {
			return nil, err
		}
		vapid, err := LoadVAPIDKey(cfg.VAPIDPath, cfg.VAPIDVersion, cfg.VAPIDPublicKey, cfg.VAPIDFingerprint)
		if err != nil {
			return nil, err
		}
		metrics := NewMetrics()
		health := NewHealthState(cfg.Paused, metrics)
		worker := NewWorker(WorkerConfig{
			API: backend, Sender: WebPushSender{Subject: cfg.VAPIDSubject}, VAPID: vapid,
			WorkerID: cfg.WorkerID, ExpectedVersion: cfg.VAPIDVersion,
			ExpectedPublicKey: cfg.VAPIDPublicKey, ExpectedFingerprint: cfg.VAPIDFingerprint,
			Paused: cfg.Paused, Metrics: metrics, OnReady: health.SetReady,
		})
		if err := worker.checkReady(); err != nil {
			return nil, err
		}
		for _, prior := range bindings {
			other := prior.Worker.api.(*HTTPBackend)
			otherOrigin, _ := canonicalAppOrigin(other.origin) // Already validated above.
			// ponytail: shared source origins need authenticated app filtering;
			// review that source contract before allowing shared endpoints.
			if prior.ID == cfg.ID || otherOrigin == origin ||
				bytes.Equal(other.secret, backend.secret) || prior.Worker.vapid.PublicKey == vapid.PublicKey {
				return nil, errors.New("app configuration reuses identity, source, credential or VAPID key")
			}
		}
		bindings = append(bindings, AppBinding{ID: cfg.ID, Worker: worker, Health: health})
	}
	return bindings, nil
}

// Finish host/port validation after NewHTTPBackend checks scheme/path/auth.
// Canonicalization detects duplicates without rewriting the configured URL.
func canonicalAppOrigin(origin string) (string, error) {
	parsed, err := url.Parse(origin)
	if err != nil || parsed.Hostname() == "" {
		return "", errors.New("app source hostname is missing")
	}
	port := 443
	if parsed.Port() != "" {
		port, err = strconv.Atoi(parsed.Port())
		if err != nil || port < 1 || port > 65535 {
			return "", errors.New("app source port is invalid")
		}
	}
	return net.JoinHostPort(strings.ToLower(parsed.Hostname()), strconv.Itoa(port)), nil
}
