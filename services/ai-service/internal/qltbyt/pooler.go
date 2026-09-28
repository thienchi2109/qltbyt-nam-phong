package qltbyt

import (
	"context"
	"errors"
	"net"
	"net/url"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/stdlib"
)

// ValidatePoolerURL enforces the dedicated Supabase transaction-pooler URL
// contract without exposing credentials in configuration errors.
func ValidatePoolerURL(raw string) error {
	parsed, err := url.Parse(raw)
	if err != nil || parsed.Scheme != "postgresql" || parsed.Hostname() == "" || parsed.Port() != "6543" || parsed.Path != "/postgres" || parsed.Fragment != "" || parsed.User == nil {
		return errors.New("external pooler database URL is invalid")
	}
	host := strings.ToLower(strings.TrimSuffix(parsed.Hostname(), "."))
	if host == "localhost" || strings.HasSuffix(host, ".localhost") {
		return errors.New("external pooler database URL is invalid")
	}
	if ip := net.ParseIP(host); ip != nil && (ip.IsLoopback() || ip.IsUnspecified()) {
		return errors.New("external pooler database URL is invalid")
	}
	username := parsed.User.Username()
	if username != "ai_query_tool" && !strings.HasPrefix(username, "ai_query_tool.") {
		return errors.New("external pooler database URL is invalid")
	}
	if username == "ai_query_tool." {
		return errors.New("external pooler database URL is invalid")
	}
	if password, ok := parsed.User.Password(); !ok || password == "" {
		return errors.New("external pooler database URL is invalid")
	}
	query, err := url.ParseQuery(parsed.RawQuery)
	if err != nil || len(query) != 1 || len(query["sslmode"]) != 1 {
		return errors.New("external pooler database URL is invalid")
	}
	switch query.Get("sslmode") {
	case "require", "verify-ca", "verify-full":
	default:
		return errors.New("external pooler database URL is invalid")
	}
	return nil
}

// OpenPoolerSQLExecutor opens and verifies the external read-only pooler.
func OpenPoolerSQLExecutor(ctx context.Context, databaseURL string, maxOpen int) (*SQLExecutor, error) {
	config, err := poolerConnectionConfig(databaseURL)
	if err != nil {
		return nil, poolerUnavailable("configuration", sqlError("invalid_url", "external pooler database URL is invalid"))
	}
	if maxOpen <= 0 {
		return nil, poolerUnavailable("configuration", sqlError("invalid_limits", "pooler connection limit is invalid"))
	}
	db := stdlib.OpenDB(*config)
	db.SetMaxOpenConns(maxOpen)
	db.SetMaxIdleConns(maxOpen)
	executor := &SQLExecutor{DB: db}
	if err := executor.checkReady(ctx); err != nil {
		_ = db.Close()
		return nil, poolerUnavailable("readiness", err)
	}
	return executor, nil
}

func poolerConnectionConfig(databaseURL string) (*pgx.ConnConfig, error) {
	if err := ValidatePoolerURL(databaseURL); err != nil {
		return nil, err
	}
	config, err := pgx.ParseConfig(databaseURL)
	if err != nil {
		return nil, errors.New("external pooler database URL is invalid")
	}
	config.DefaultQueryExecMode = pgx.QueryExecModeSimpleProtocol
	return config, nil
}
