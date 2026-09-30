package main

import (
	"context"
	"errors"
	"fmt"
	"log"
	"net"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"strings"
	"syscall"
	"time"

	"example.com/shared-ai-service/internal/composition"
	"example.com/shared-ai-service/internal/ingress"
	"example.com/shared-ai-service/internal/orchestration"
	"example.com/shared-ai-service/internal/protocol"
	"example.com/shared-ai-service/internal/provider"
	"example.com/shared-ai-service/internal/registry"
	"example.com/shared-ai-service/internal/usage"
)

const (
	defaultListenAddr    = "127.0.0.1:8080"
	defaultMaxConcurrent = 16
)

type runtimeConfig struct {
	listenAddr        string
	maxConcurrent     int
	drainGrace        time.Duration
	cleanupGrace      time.Duration
	reservationTTL    time.Duration
	hmacKeyID         string
	hmacSecret        []byte
	brokerSecret      []byte
	brokerEndpoint    string
	databaseURL       string
	appID             string
	capabilityID      string
	capabilityVersion string
	providerEnv       map[string]string
	chain             provider.ChainConfig
}

type serviceRuntime struct {
	config           runtimeConfig
	configErr        error
	configDiagnostic string
	handler          *ingress.Handler
	lifecycle        *ingress.Lifecycle
	database         composition.QueryExecutor
}

func main() {
	runtime := newServiceRuntime(environment())
	if runtime == nil || runtime.handler == nil {
		log.Print("ai-service runtime initialization failed closed")
		return
	}
	defer runtime.close()
	if runtime.configErr != nil {
		diagnostic := runtime.configDiagnostic
		if diagnostic == "" {
			diagnostic = protocol.DiagnosticProviderConfiguration
		}
		log.Printf("ai-service configuration is unavailable; readiness remains false diagnostic=%s", diagnostic)
	}
	server := &http.Server{
		Addr:              runtime.config.listenAddr,
		Handler:           runtime.handler,
		ReadHeaderTimeout: 5 * time.Second,
	}
	started := make(chan error, 1)
	go func() { started <- server.ListenAndServe() }()
	signals := make(chan os.Signal, 1)
	signal.Notify(signals, syscall.SIGINT, syscall.SIGTERM)
	defer signal.Stop(signals)
	select {
	case err := <-started:
		if !errors.Is(err, http.ErrServerClosed) {
			log.Print("ai-service HTTP server stopped")
		}
	case <-signals:
		shutdown(runtime, server)
	}
}

func shutdown(runtime *serviceRuntime, server *http.Server) {
	if runtime != nil && runtime.lifecycle != nil {
		ctx, cancel := context.WithTimeout(context.Background(), runtime.lifecycle.StopTimeout())
		defer cancel()
		serverDone := make(chan struct{})
		go func() {
			_ = server.Shutdown(ctx)
			close(serverDone)
		}()
		_ = runtime.lifecycle.Drain(ctx)
		<-serverDone
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), protocol.CleanupBudget)
	defer cancel()
	_ = server.Shutdown(ctx)
}

func newServiceRuntime(env map[string]string) *serviceRuntime {
	config, err := loadRuntimeConfig(env)
	if err != nil {
		admission := ingress.NewAdmission(defaultMaxConcurrent)
		lifecycle, lifecycleErr := ingress.NewLifecycle(admission, protocol.DrainGraceMin, protocol.CleanupBudget)
		if lifecycleErr != nil {
			return &serviceRuntime{configErr: err}
		}
		handler := &ingress.Handler{
			Admission: admission,
			Lifecycle: lifecycle,
			ConfigReady: func() bool {
				return false
			},
		}
		return &serviceRuntime{config: runtimeConfig{listenAddr: defaultListenAddr}, configErr: err, configDiagnostic: provider.ConfigurationDiagnostic(err), handler: handler, lifecycle: lifecycle}
	}
	admission := ingress.NewAdmission(config.maxConcurrent)
	lifecycle, lifecycleErr := ingress.NewLifecycle(admission, config.drainGrace, config.cleanupGrace)
	if lifecycleErr != nil {
		return newServiceRuntime(map[string]string{})
	}
	metrics := ingress.NewMetrics()
	reg := registry.New()
	chain, chainErr := provider.NewChain(context.Background(), config.chain)
	if chainErr != nil {
		return &serviceRuntime{config: config, configErr: chainErr, configDiagnostic: provider.InitializationDiagnostic(chainErr), lifecycle: lifecycle, handler: &ingress.Handler{Admission: admission, Lifecycle: lifecycle, Metrics: metrics}}
	}
	var queryExecutor composition.QueryExecutor
	if config.brokerEndpoint != "" {
		queryExecutor, err = composition.OpenPoolerQueryExecutor(context.Background(), config.databaseURL, config.maxConcurrent)
		if err != nil {
			logPoolerConnectionFailure(err)
		}
	}
	capabilityReady := composition.RegisterAssistantWithEndpoint(reg, config.brokerEndpoint, nil, config.brokerSecret, queryExecutor)
	runner := &orchestration.Runner{
		Registry: reg,
		Usage:    usage.NewMemory(time.Now),
		Open: func(ctx context.Context, _ protocol.Request) (orchestration.ModelSession, error) {
			// ChainSession owns per-request attempt state; build a fresh session
			// so concurrent requests cannot share fallback cursors.
			return provider.NewChain(ctx, config.chain)
		},
	}
	guard := ingress.NewReplayGuard(time.Now(), []ingress.Key{{
		ID:           config.hmacKeyID,
		Secret:       config.hmacSecret,
		Issuer:       "nextjs-bff",
		Audience:     "ai-service-v1",
		AppID:        config.appID,
		CapabilityID: config.capabilityID,
	}})
	handler := &ingress.Handler{
		Guard:     guard,
		Registry:  reg,
		Runner:    runner,
		Admission: admission,
		Lifecycle: lifecycle,
		Metrics:   metrics,
		ConfigReady: func() bool {
			if chain == nil || queryExecutor == nil || !capabilityReady || reg == nil || len(config.hmacSecret) == 0 || len(config.brokerSecret) == 0 || config.appID == "" || config.capabilityID == "" || config.capabilityVersion == "" {
				return false
			}
			_, lookupErr := reg.Lookup(config.appID, config.capabilityID, config.capabilityVersion)
			if lookupErr != nil {
				return false
			}
			return composition.QueryExecutorReady(context.Background(), queryExecutor)
		},
	}
	return &serviceRuntime{config: config, handler: handler, lifecycle: lifecycle, database: queryExecutor}
}

func logPoolerConnectionFailure(err error) {
	log.Printf("ai-service external-pooler query connection is unavailable; readiness remains false (%s)", composition.PoolerDiagnostic(err))
}

func (runtime *serviceRuntime) close() {
	if runtime != nil && runtime.database != nil {
		_ = composition.CloseQueryExecutor(runtime.database)
	}
}

func loadRuntimeConfig(env map[string]string) (runtimeConfig, error) {
	values := copyEnv(env)
	hmacSecret, err := readSecretFile(values["AI_SERVICE_HMAC_SECRET_FILE"])
	if err != nil {
		return runtimeConfig{}, err
	}
	brokerSecret, err := readSecretFile(values["AI_SERVICE_BROKER_SECRET_FILE"])
	if err != nil {
		return runtimeConfig{}, err
	}
	nvidiaKey, err := readSecretFile(values["NVIDIA_API_KEY_FILE"])
	if err != nil {
		return runtimeConfig{}, err
	}
	googleKeys, err := readSecretFile(values["GOOGLE_GENERATIVE_AI_API_KEYS_FILE"])
	if err != nil {
		return runtimeConfig{}, err
	}
	values["NVIDIA_API_KEY"] = string(nvidiaKey)
	values["GOOGLE_GENERATIVE_AI_API_KEYS"] = string(googleKeys)
	if strings.TrimSpace(values["AI_SERVICE_HMAC_KEY_ID"]) == "" {
		return runtimeConfig{}, errors.New("HMAC key id is unavailable")
	}
	chain, err := provider.ChainConfigFromEnv(values)
	if err != nil {
		return runtimeConfig{}, &runtimeConfigurationError{cause: err}
	}
	maxConcurrent, err := positiveInt(values["AI_SERVICE_MAX_CONCURRENT"], defaultMaxConcurrent)
	if err != nil {
		return runtimeConfig{}, err
	}
	drainGrace, err := duration(values["AI_SERVICE_DRAIN_GRACE"], protocol.DrainGraceMin)
	if err != nil || drainGrace < protocol.DrainGraceMin || drainGrace > protocol.DrainGraceMax {
		return runtimeConfig{}, ingress.ErrInvalidDrainGrace
	}
	cleanupGrace, err := duration(values["AI_SERVICE_CLEANUP_GRACE"], protocol.CleanupBudget)
	if err != nil || cleanupGrace < 0 || cleanupGrace > protocol.CleanupBudget {
		return runtimeConfig{}, errors.New("cleanup budget is unavailable")
	}
	reservationTTL, err := duration(values["AI_SERVICE_RESERVATION_TTL"], protocol.ReservationTTL)
	if err != nil || reservationTTL < protocol.ReservationTTL {
		return runtimeConfig{}, errors.New("reservation TTL is unavailable")
	}
	brokerEndpoint := strings.TrimSpace(firstNonEmpty(values["AI_SERVICE_BFF_BROKER_URL"], values["AI_SERVICE_BROKER_URL"]))
	if brokerEndpoint != "" {
		if _, err := composition.NewBroker(brokerEndpoint, nil); err != nil {
			return runtimeConfig{}, err
		}
	}
	databaseURL := strings.TrimSpace(values["AI_DATABASE_URL"])
	if err := composition.ValidatePoolerURL(databaseURL); err != nil {
		return runtimeConfig{}, err
	}
	delete(values, "AI_DATABASE_URL")
	listenAddr, err := privateListenAddr(values["AI_SERVICE_LISTEN_ADDR"])
	if err != nil {
		return runtimeConfig{}, err
	}
	return runtimeConfig{
		listenAddr:        listenAddr,
		maxConcurrent:     maxConcurrent,
		drainGrace:        drainGrace,
		cleanupGrace:      cleanupGrace,
		reservationTTL:    reservationTTL,
		hmacKeyID:         strings.TrimSpace(values["AI_SERVICE_HMAC_KEY_ID"]),
		hmacSecret:        hmacSecret,
		brokerSecret:      brokerSecret,
		brokerEndpoint:    brokerEndpoint,
		databaseURL:       databaseURL,
		appID:             strings.TrimSpace(values["AI_SERVICE_APP_ID"]),
		capabilityID:      strings.TrimSpace(values["AI_SERVICE_CAPABILITY_ID"]),
		capabilityVersion: strings.TrimSpace(values["AI_SERVICE_CAPABILITY_VERSION"]),
		providerEnv:       values,
		chain:             chain,
	}, nil
}

func privateListenAddr(value string) (string, error) {
	value = strings.TrimSpace(value)
	if value == "" {
		return defaultListenAddr, nil
	}
	host, _, err := net.SplitHostPort(value)
	if err != nil || (host != "127.0.0.1" && host != "::1") {
		return "", errors.New("listen address must be loopback-only")
	}
	return value, nil
}

func readSecretFile(path string) ([]byte, error) {
	if strings.TrimSpace(path) == "" {
		return nil, errors.New("required secret file is unavailable")
	}
	value, err := os.ReadFile(path)
	if err != nil {
		return nil, errors.New("required secret file is unavailable")
	}
	value = []byte(strings.TrimSpace(string(value)))
	if len(value) == 0 {
		return nil, errors.New("required secret file is empty")
	}
	return value, nil
}

func environment() map[string]string {
	values := make(map[string]string)
	for _, item := range os.Environ() {
		key, value, ok := strings.Cut(item, "=")
		if ok {
			values[key] = value
		}
	}
	return values
}

func copyEnv(values map[string]string) map[string]string {
	copy := make(map[string]string, len(values))
	for key, value := range values {
		copy[key] = value
	}
	return copy
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return value
		}
	}
	return ""
}

func positiveInt(value string, fallback int) (int, error) {
	if strings.TrimSpace(value) == "" {
		return fallback, nil
	}
	parsed, err := strconv.Atoi(strings.TrimSpace(value))
	if err != nil || parsed <= 0 {
		return 0, errors.New("concurrency limit is unavailable")
	}
	return parsed, nil
}

func duration(value string, fallback time.Duration) (time.Duration, error) {
	if strings.TrimSpace(value) == "" {
		return fallback, nil
	}
	parsed, err := time.ParseDuration(strings.TrimSpace(value))
	if err != nil {
		return 0, fmt.Errorf("duration is unavailable")
	}
	return parsed, nil
}
