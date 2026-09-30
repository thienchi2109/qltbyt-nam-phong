package main

type runtimeConfigurationError struct {
	cause error
}

func (e *runtimeConfigurationError) Error() string { return "provider configuration is unavailable" }

func (e *runtimeConfigurationError) Unwrap() error {
	if e == nil {
		return nil
	}
	return e.cause
}
