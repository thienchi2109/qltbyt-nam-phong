package qltbyt

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"
)

func readyQueryDriver() *queryDriver {
	catalog := readinessCatalog{
		schemaExists: true,
		schemaUsage:  true,
		viewKinds:    make(map[string]string, len(approvedViews)),
		viewSelect:   make(map[string]bool, len(approvedViews)),
	}
	for view := range approvedViews {
		catalog.viewKinds[view] = "v"
		catalog.viewSelect[view] = true
	}
	return &queryDriver{role: "ai_query_tool", readOnly: "on", defaultReadOnly: "on", catalog: catalog}
}

func TestSQLExecutorReadyRequiresConnectedReadOnlyDedicatedRole(t *testing.T) {
	for _, tc := range []struct {
		name, role, readOnly, defaultReadOnly string
		connectErr, wantReady                 bool
	}{
		{name: "dedicated read-only", role: "ai_query_tool", readOnly: "on", defaultReadOnly: "on", wantReady: true},
		{name: "wrong role", role: "postgres", readOnly: "on", defaultReadOnly: "on"},
		{name: "write transaction", role: "ai_query_tool", readOnly: "off", defaultReadOnly: "on"},
		{name: "writable role default", role: "ai_query_tool", readOnly: "on", defaultReadOnly: "off"},
		{name: "connection unavailable", connectErr: true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			d := readyQueryDriver()
			d.role, d.readOnly, d.defaultReadOnly, d.connectErr = tc.role, tc.readOnly, tc.defaultReadOnly, tc.connectErr
			e := testSQLExecutor(t, d)
			err := e.Ready(context.Background())
			if (err == nil) != tc.wantReady {
				t.Fatalf("Ready() error = %v, want ready=%v", err, tc.wantReady)
			}
			if tc.wantReady {
				probed := make(map[string]bool, len(d.catalogMetaProbes))
				for _, view := range d.catalogMetaProbes {
					probed[view] = true
				}
				if len(probed) != len(approvedViews) {
					t.Fatalf("catalog probes = %v, want every approved view", d.catalogMetaProbes)
				}
				for view := range approvedViews {
					if !probed[view] {
						t.Fatalf("approved view %q was not probed", view)
					}
				}
			}
			if err != nil && strings.Contains(err.Error(), "secret") {
				t.Fatalf("readiness error exposed driver details: %v", err)
			}
		})
	}
}

func TestSQLExecutorReadyRequiresUsableApprovedCatalog(t *testing.T) {
	for _, tc := range []struct {
		name  string
		setup func(*queryDriver)
	}{
		{name: "missing schema", setup: func(d *queryDriver) { d.catalog.schemaExists = false }},
		{name: "missing approved view", setup: func(d *queryDriver) { delete(d.catalog.viewKinds, "equipment_search") }},
		{name: "missing another approved view", setup: func(d *queryDriver) { delete(d.catalog.viewKinds, "quota_facts") }},
		{name: "approved relation is not a view", setup: func(d *queryDriver) { d.catalog.viewKinds["equipment_search"] = "r" }},
		{name: "missing schema usage", setup: func(d *queryDriver) { d.catalog.schemaUsage = false }},
		{name: "missing view SELECT", setup: func(d *queryDriver) { d.catalog.viewSelect["equipment_search"] = false }},
		{name: "catalog metadata failure", setup: func(d *queryDriver) { d.catalog.metadataError = errors.New("synthetic metadata secret") }},
		{name: "catalog result failure", setup: func(d *queryDriver) { d.catalog.metadataNextError = errors.New("synthetic result secret") }},
		{name: "catalog close failure", setup: func(d *queryDriver) { d.catalog.metadataCloseError = errors.New("synthetic close secret") }},
	} {
		t.Run(tc.name, func(t *testing.T) {
			d := readyQueryDriver()
			tc.setup(d)
			e := testSQLExecutor(t, d)
			if err := e.Ready(context.Background()); err == nil {
				t.Fatal("unusable approved catalog reported ready")
			} else if strings.Contains(err.Error(), "secret") {
				t.Fatalf("readiness error exposed driver details: %v", err)
			}
		})
	}
}

func TestSQLExecutorReadyPreservesCatalogProbeCancellation(t *testing.T) {
	d := readyQueryDriver()
	d.catalog.metadataStarted = make(chan struct{}, 1)
	d.catalog.blockMetadataResult = true
	e := testSQLExecutor(t, d)
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	ready := make(chan error, 1)
	go func() { ready <- e.Ready(ctx) }()
	select {
	case <-d.catalog.metadataStarted:
	case err := <-ready:
		t.Fatalf("Ready returned before probing the catalog: %v", err)
	case <-time.After(time.Second):
		t.Fatal("catalog readiness query did not start")
	}
	cancel()
	if err := <-ready; !errors.Is(err, context.Canceled) {
		t.Fatalf("Ready() error = %v, want context.Canceled", err)
	}
}

func TestSQLExecutorReadyRejectsMissingPool(t *testing.T) {
	if err := (SQLExecutor{}).Ready(context.Background()); err == nil {
		t.Fatal("SQLExecutor without a pool reported ready")
	}
}

func TestSQLExecutorReadyPreservesCancellation(t *testing.T) {
	d := readyQueryDriver()
	e := testSQLExecutor(t, d)
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if err := e.Ready(ctx); !errors.Is(err, context.Canceled) {
		t.Fatalf("Ready() error = %v, want context.Canceled", err)
	}
}
