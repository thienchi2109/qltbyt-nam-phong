package webpush

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"sync"
	"sync/atomic"
	"time"
)

// MaxRuntimeApps reserves five send slots per app: at most 80 sends globally.
// ponytail: fixed reservations guarantee progress; revisit only for measured
// demand above 16 apps, without letting one app exhaust another's capacity.
const MaxRuntimeApps = 16

// Runtime runs each trusted binding independently, with no prefetch or shared queue.
// A terminal worker stays stopped and unready until the process is restarted.
type Runtime struct {
	bindings []AppBinding
	started  atomic.Bool
}

func NewRuntime(bindings []AppBinding) (*Runtime, error) {
	if len(bindings) == 0 || len(bindings) > MaxRuntimeApps {
		return nil, errors.New("runtime requires 1 to 16 app bindings")
	}
	for index, b := range bindings {
		if ValidateAppID(b.ID) != nil || b.Worker == nil || b.Health == nil || b.Worker.metrics == nil ||
			b.Health.metrics != b.Worker.metrics {
			return nil, errors.New("runtime app binding is invalid")
		}
		for _, prior := range bindings[:index] {
			if b.ID == prior.ID || b.Worker == prior.Worker || b.Health == prior.Health || b.Worker.metrics == prior.Worker.metrics {
				return nil, errors.New("runtime app bindings share identity or state")
			}
		}
	}
	for _, b := range bindings {
		b.Worker.onReady = b.Health.SetReady
	}
	return &Runtime{bindings: append([]AppBinding(nil), bindings...)}, nil
}

// Run cancels in-flight calls through ctx and joins every worker. Unreported
// attempts stay owned by the source until lease expiry; shutdown never resends.
func (rt *Runtime) Run(ctx context.Context) error {
	if !rt.started.CompareAndSwap(false, true) {
		return errors.New("runtime has already started")
	}
	var wg sync.WaitGroup
	for _, binding := range rt.bindings {
		wg.Add(1)
		go func(b AppBinding) {
			defer wg.Done()
			defer b.Health.markStopped()
			_ = b.Worker.Run(ctx)
		}(binding)
	}
	<-ctx.Done()
	wg.Wait()
	return ctx.Err()
}

// Handler is served by one loopback listener, shared by all configured apps.
func (rt *Runtime) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", rt.bindings[0].Health.health)
	mux.HandleFunc("/readyz", rt.readyz)
	mux.HandleFunc("/readyz/", rt.readyz)
	mux.HandleFunc("/metrics", rt.metrics)
	return mux
}

func (rt *Runtime) readyz(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	now := time.Now()
	if r.URL.Path != "/readyz" {
		id := strings.TrimPrefix(r.URL.Path, "/readyz/")
		for _, b := range rt.bindings {
			if b.ID == id {
				status := b.Health.status(now)
				code := http.StatusServiceUnavailable
				if status == "ready" {
					code = http.StatusOK
				}
				writeHealth(w, code, status+"\n")
				return
			}
		}
		http.NotFound(w, r)
		return
	}
	response := struct {
		Ready bool              `json:"ready"`
		Apps  map[string]string `json:"apps"`
	}{Ready: true, Apps: make(map[string]string, len(rt.bindings))}
	for _, b := range rt.bindings {
		status := b.Health.status(now)
		response.Apps[b.ID] = status
		response.Ready = response.Ready && status == "ready"
	}
	w.Header().Set("Content-Type", "application/json")
	if !response.Ready {
		w.WriteHeader(http.StatusServiceUnavailable)
	}
	_ = json.NewEncoder(w).Encode(response)
}

func (rt *Runtime) metrics(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	w.Header().Set("Content-Type", "text/plain; version=0.0.4")
	for index, b := range rt.bindings {
		b.Worker.metrics.write(w, fmt.Sprintf("{app_id=%q}", b.ID), index == 0)
	}
}
