package qltbyt

import (
	"context"
	"errors"
	"net"
	"strings"

	"github.com/jackc/pgx/v5/pgconn"
)

type poolerUnavailableError struct {
	diagnostic string
}

func (e *poolerUnavailableError) Error() string {
	return "external pooler query executor is unavailable"
}

func (e *poolerUnavailableError) PoolerDiagnostic() string {
	return e.diagnostic
}

// PoolerDiagnostic returns a redacted category/cause for server-side logs.
func PoolerDiagnostic(err error) string {
	var diagnostic interface{ PoolerDiagnostic() string }
	if errors.As(err, &diagnostic) {
		return diagnostic.PoolerDiagnostic()
	}
	return "stage=unknown cause=unknown"
}

func poolerUnavailable(stage string, cause error) error {
	return &poolerUnavailableError{diagnostic: "stage=" + stage + " cause=" + poolerCause(cause)}
}

func poolerCause(err error) string {
	if err == nil {
		return "unknown"
	}
	if errors.Is(err, context.DeadlineExceeded) {
		return "timeout"
	}
	if errors.Is(err, context.Canceled) {
		return "canceled"
	}
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.Code != "" {
		if len(pgErr.Code) == 5 && strings.Trim(pgErr.Code, "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ") == "" {
			return "postgres_sqlstate_" + pgErr.Code
		}
		return "postgres_error"
	}
	var sqlErr *SQLError
	if errors.As(err, &sqlErr) && sqlErr.Code != "" {
		switch sqlErr.Code {
		case "invalid_url", "invalid_limits", "disabled":
			return "sql_" + sqlErr.Code
		default:
			return "sql_error"
		}
	}
	var netErr net.Error
	if errors.As(err, &netErr) {
		if netErr.Timeout() {
			return "network_timeout"
		}
		return "network_error"
	}
	return "connection_error"
}
