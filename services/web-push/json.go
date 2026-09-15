package webpush

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
)

var knownResponseFields = map[string]struct{}{
	"version": {}, "server_time": {}, "poll_after_seconds": {}, "deliveries": {},
	"delivery_id": {}, "attempt_token": {}, "attempt": {}, "subscription_id": {},
	"subscription_revision": {}, "lease_expires_at": {}, "deadline": {}, "ttl_seconds": {},
	"vapid_key_version": {}, "endpoint": {}, "keys": {}, "p256dh": {}, "auth": {},
	"payload_base64": {}, "results": {}, "result": {}, "error": {}, "code": {},
	"retry_after_seconds": {},
}

func decodeStrictJSON(data []byte, target interface{}, allowNullPath string) error {
	if err := validateJSONDocument(data, allowNullPath); err != nil {
		return err
	}
	decoder := json.NewDecoder(bytes.NewReader(data))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(target); err != nil {
		return err
	}
	if _, err := decoder.Token(); err != io.EOF {
		if err == nil {
			return errors.New("trailing JSON")
		}
		return err
	}
	return nil
}

func validateResponseVersion(data []byte, allowNullPath string) error {
	var fields map[string]json.RawMessage
	if err := decodeStrictJSON(data, &fields, allowNullPath); err != nil {
		return err
	}
	rawVersion, ok := fields["version"]
	if !ok || len(rawVersion) == 0 {
		return errors.New("version is required")
	}
	var version int
	if err := json.Unmarshal(rawVersion, &version); err != nil {
		return fmt.Errorf("version has the wrong type: %w", err)
	}
	if version != 1 {
		return ErrUnsupportedVersion
	}
	return nil
}

func validateJSONDocument(data []byte, allowNullPath string) error {
	decoder := json.NewDecoder(bytes.NewReader(data))
	token, err := decoder.Token()
	if err != nil {
		return err
	}
	if delimiter, ok := token.(json.Delim); !ok || delimiter != '{' {
		return errors.New("JSON object required")
	}
	if err := validateJSONObject(decoder, "$", allowNullPath); err != nil {
		return err
	}
	if _, err := decoder.Token(); err != io.EOF {
		if err == nil {
			return errors.New("trailing JSON")
		}
		return err
	}
	return nil
}

func validateJSONValue(decoder *json.Decoder, path, allowNullPath string) error {
	token, err := decoder.Token()
	if err != nil {
		return err
	}
	if token == nil {
		if path == allowNullPath {
			return nil
		}
		return errors.New("null JSON value")
	}
	switch delimiter, ok := token.(json.Delim); {
	case ok && delimiter == '{':
		return validateJSONObject(decoder, path, allowNullPath)
	case ok && delimiter == '[':
		return validateJSONArray(decoder, path, allowNullPath)
	default:
		return nil
	}
}

func validateJSONObject(decoder *json.Decoder, path, allowNullPath string) error {
	keys := make(map[string]struct{})
	for decoder.More() {
		token, err := decoder.Token()
		if err != nil {
			return err
		}
		key, ok := token.(string)
		if !ok {
			return errors.New("JSON object key required")
		}
		if _, known := knownResponseFields[key]; !known {
			return fmt.Errorf("unknown JSON field %q", key)
		}
		if _, exists := keys[key]; exists {
			return fmt.Errorf("duplicate JSON field %q", key)
		}
		keys[key] = struct{}{}
		if err := validateJSONValue(decoder, path+"."+key, allowNullPath); err != nil {
			return err
		}
	}
	closing, err := decoder.Token()
	if err != nil {
		return err
	}
	if closing != json.Delim('}') {
		return errors.New("JSON object not closed")
	}
	return nil
}

func validateJSONArray(decoder *json.Decoder, path, allowNullPath string) error {
	index := 0
	for decoder.More() {
		if err := validateJSONValue(decoder, fmt.Sprintf("%s[%d]", path, index), allowNullPath); err != nil {
			return err
		}
		index++
	}
	closing, err := decoder.Token()
	if err != nil {
		return err
	}
	if closing != json.Delim(']') {
		return errors.New("JSON array not closed")
	}
	return nil
}
