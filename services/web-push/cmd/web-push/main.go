package main

import (
	"context"
	"log/slog"
	"os"
	"os/signal"
	"syscall"

	webpush "github.com/qltbyt-nam-phong/web-push"
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stderr, &slog.HandlerOptions{Level: slog.LevelInfo}))
	origin := os.Getenv("WEB_PUSH_ORIGIN")
	workerID := getenv("WEB_PUSH_WORKER_ID", "oracle-web-push-1")
	vapidVersion := os.Getenv("WEB_PUSH_VAPID_KEY_VERSION")
	vapidPublicKey := os.Getenv("WEB_PUSH_VAPID_PUBLIC_KEY")
	vapidFingerprint := os.Getenv("WEB_PUSH_VAPID_FINGERPRINT")
	vapidPath := getenv("WEB_PUSH_VAPID_PRIVATE_KEY_PATH", "/run/secrets/web_push_vapid_private_key")
	subject := os.Getenv("WEB_PUSH_VAPID_SUBJECT")
	if vapidVersion == "" || vapidPublicKey == "" || vapidFingerprint == "" {
		logger.Error("web push VAPID public artifact is not configured")
		os.Exit(1)
	}
	if subject == "" {
		logger.Error("web push VAPID subject is not configured")
		os.Exit(1)
	}

	vapid, err := webpush.LoadVAPIDKey(vapidPath, vapidVersion, vapidPublicKey, vapidFingerprint)
	if err != nil {
		logger.Error("web push worker is not ready", "error", err)
		os.Exit(1)
	}
	backend, err := webpush.NewHTTPBackend(
		origin,
		os.Getenv("WEB_PUSH_HMAC_KEY_ID"),
		os.Getenv("WEB_PUSH_HMAC_SECRET"),
		nil,
	)
	if err != nil {
		logger.Error("web push backend configuration is invalid", "error", err)
		os.Exit(1)
	}
	worker := webpush.NewWorker(webpush.WorkerConfig{
		API:                 backend,
		Sender:              webpush.WebPushSender{Subject: subject},
		VAPID:               vapid,
		WorkerID:            workerID,
		ExpectedVersion:     vapidVersion,
		ExpectedPublicKey:   vapidPublicKey,
		ExpectedFingerprint: vapidFingerprint,
	})
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()
	if err := worker.Run(ctx); err != nil && ctx.Err() == nil {
		logger.Error("web push worker stopped", "error", err)
		os.Exit(1)
	}
}

func getenv(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}
