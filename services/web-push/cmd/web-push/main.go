package main

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	webpush "github.com/qltbyt-nam-phong/web-push"
)

const defaultHealthAddress = "127.0.0.1:8080"

type appConfig struct {
	appID            string
	origin           string
	workerID         string
	vapidVersion     string
	vapidPublicKey   string
	vapidFingerprint string
	vapidPath        string
	vapidSubject     string
	hmacKeyID        string
	hmacSecret       string
	healthAddress    string
	paused           bool
}

func main() {
	cfg, err := loadConfig(os.Getenv)
	if err != nil {
		writeStartupError(os.Stderr, "configuration_invalid", err)
		os.Exit(1)
	}
	if cfg.vapidVersion == "" || cfg.vapidPublicKey == "" || cfg.vapidFingerprint == "" {
		writeStartupError(os.Stderr, "vapid_artifact_missing", nil)
		os.Exit(1)
	}
	if strings.TrimSpace(cfg.vapidSubject) == "" {
		writeStartupError(os.Stderr, "vapid_subject_missing", nil)
		os.Exit(1)
	}

	bindings, err := webpush.NewAppBindings([]webpush.AppConfig{{
		ID: cfg.appID, Origin: cfg.origin, WorkerID: cfg.workerID,
		HMACKeyID: cfg.hmacKeyID, HMACSecret: cfg.hmacSecret,
		VAPIDVersion: cfg.vapidVersion, VAPIDPublicKey: cfg.vapidPublicKey,
		VAPIDFingerprint: cfg.vapidFingerprint, VAPIDPath: cfg.vapidPath,
		VAPIDSubject: cfg.vapidSubject, Paused: cfg.paused,
	}}, nil)
	if err != nil {
		code := "backend_configuration_invalid"
		if errors.Is(err, webpush.ErrVAPIDMismatch) || errors.Is(err, webpush.ErrVAPIDNotReady) {
			code = vapidErrorCode(err)
		}
		writeStartupError(os.Stderr, code, err)
		os.Exit(1)
	}

	binding := bindings[0]
	server := &http.Server{
		Addr:              cfg.healthAddress,
		Handler:           binding.Health.Handler(),
		ReadHeaderTimeout: 2 * time.Second,
	}
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	healthErr := make(chan error, 1)
	go func() {
		if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			healthErr <- err
		}
	}()
	workerErr := make(chan error, 1)
	go func() { workerErr <- binding.Worker.Run(ctx) }()

	exitCode := 0
	workerDone := false
	select {
	case err := <-healthErr:
		writeStartupError(os.Stderr, "health_server_failed", err)
		exitCode = 1
	case err := <-workerErr:
		workerDone = true
		if ctx.Err() == nil {
			writeStartupError(os.Stderr, "worker_stopped", err)
			exitCode = 1
			stop()
		}
	case <-ctx.Done():
	}

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	_ = server.Shutdown(shutdownCtx)
	cancel()
	if ctx.Err() == nil {
		stop()
	}
	if !workerDone {
		select {
		case <-workerErr:
		case <-time.After(5 * time.Second):
		}
	}
	if exitCode != 0 {
		os.Exit(exitCode)
	}
}

func loadConfig(get func(string) string) (appConfig, error) {
	if get == nil {
		get = os.Getenv
	}
	paused, err := webpush.ParsePause(get("WEB_PUSH_PAUSED"))
	cfg := appConfig{
		appID:            getenvFrom(get, "WEB_PUSH_APP_ID", "qltbyt"),
		origin:           get("WEB_PUSH_ORIGIN"),
		workerID:         getenvFrom(get, "WEB_PUSH_WORKER_ID", "oracle-web-push-1"),
		vapidVersion:     get("WEB_PUSH_VAPID_KEY_VERSION"),
		vapidPublicKey:   get("WEB_PUSH_VAPID_PUBLIC_KEY"),
		vapidFingerprint: get("WEB_PUSH_VAPID_FINGERPRINT"),
		vapidPath:        getenvFrom(get, "WEB_PUSH_VAPID_PRIVATE_KEY_PATH", "/run/secrets/web_push_vapid_private_key"),
		vapidSubject:     get("WEB_PUSH_VAPID_SUBJECT"),
		hmacKeyID:        get("WEB_PUSH_HMAC_KEY_ID"),
		hmacSecret:       get("WEB_PUSH_HMAC_SECRET"),
		healthAddress:    getenvFrom(get, "WEB_PUSH_HEALTH_ADDR", defaultHealthAddress),
		paused:           paused,
	}
	if err != nil {
		return cfg, err
	}
	if err := webpush.ValidateAppID(cfg.appID); err != nil {
		return cfg, err
	}
	if err := webpush.ValidateHealthAddress(cfg.healthAddress); err != nil {
		return cfg, err
	}
	return cfg, nil
}

func getenvFrom(get func(string) string, key, fallback string) string {
	if value := strings.TrimSpace(get(key)); value != "" {
		return value
	}
	return fallback
}

func writeStartupError(w io.Writer, code string, _ error) {
	if !safeErrorCode(code) {
		code = "internal_error"
	}
	_, _ = fmt.Fprintf(w, "web_push_error code=%s\n", code)
}

func safeErrorCode(code string) bool {
	if len(code) == 0 || len(code) > 64 {
		return false
	}
	for _, char := range code {
		if (char < 'a' || char > 'z') && (char < '0' || char > '9') && char != '_' {
			return false
		}
	}
	return true
}

func vapidErrorCode(err error) string {
	if errors.Is(err, webpush.ErrVAPIDMismatch) {
		return "vapid_artifact_mismatch"
	}
	return "vapid_unavailable"
}

func getenv(key, fallback string) string { return getenvFrom(os.Getenv, key, fallback) }
