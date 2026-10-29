package main

import (
	"bytes"
	"encoding/json"
	"errors"
	"io"
	"os"

	webpush "github.com/qltbyt-nam-phong/web-push"
)

const maxAppsConfigBytes = 1 << 20

// File mode is explicit: invalid/missing files never fall back to legacy envs.
func loadRuntimeConfig(get func(string) string) ([]webpush.AppConfig, string, bool, error) {
	if get == nil {
		get = os.Getenv
	}
	path := getenvFrom(get, "WEB_PUSH_APPS_CONFIG_PATH", "")
	address := getenvFrom(get, "WEB_PUSH_HEALTH_ADDR", defaultHealthAddress)
	if err := webpush.ValidateHealthAddress(address); err != nil {
		return nil, address, false, err
	}
	if path == "" {
		cfg, err := loadConfig(get)
		return []webpush.AppConfig{{
			ID: cfg.appID, Origin: cfg.origin, WorkerID: cfg.workerID,
			HMACKeyID: cfg.hmacKeyID, HMACSecret: cfg.hmacSecret,
			VAPIDVersion: cfg.vapidVersion, VAPIDPublicKey: cfg.vapidPublicKey,
			VAPIDFingerprint: cfg.vapidFingerprint, VAPIDPath: cfg.vapidPath,
			VAPIDSubject: cfg.vapidSubject, Paused: cfg.paused,
		}}, address, false, err
	}
	file, err := os.Open(path)
	if err != nil {
		return nil, address, true, errors.New("app configuration file is unavailable")
	}
	defer file.Close()
	configs, err := readAppConfigs(file)
	return configs, address, true, err
}

func readAppConfigs(reader io.Reader) ([]webpush.AppConfig, error) {
	data, err := io.ReadAll(io.LimitReader(reader, maxAppsConfigBytes+1))
	if err != nil || len(data) > maxAppsConfigBytes {
		return nil, errors.New("app configuration exceeds size limit or cannot be read")
	}
	decoder := json.NewDecoder(bytes.NewReader(data))
	if token, err := decoder.Token(); err != nil || token != json.Delim('[') {
		return nil, errors.New("app configuration must be an array")
	}
	var configs []webpush.AppConfig
	for decoder.More() {
		if len(configs) == webpush.MaxRuntimeApps {
			return nil, errors.New("too many configured apps")
		}
		cfg, err := readAppConfig(decoder)
		if err != nil {
			return nil, err
		}
		configs = append(configs, cfg)
	}
	if token, err := decoder.Token(); err != nil || token != json.Delim(']') {
		return nil, errors.New("app configuration array is invalid")
	}
	if _, err := decoder.Token(); err != io.EOF || len(configs) == 0 {
		return nil, errors.New("app configuration is empty or has trailing data")
	}
	return configs, nil
}

func readAppConfig(decoder *json.Decoder) (webpush.AppConfig, error) {
	cfg := webpush.AppConfig{WorkerID: "oracle-web-push-1", Paused: true}
	fields := map[string]interface{}{
		"id": &cfg.ID, "origin": &cfg.Origin, "worker_id": &cfg.WorkerID,
		"hmac_key_id": &cfg.HMACKeyID, "hmac_secret": &cfg.HMACSecret,
		"vapid_version": &cfg.VAPIDVersion, "vapid_public_key": &cfg.VAPIDPublicKey,
		"vapid_fingerprint": &cfg.VAPIDFingerprint, "vapid_path": &cfg.VAPIDPath,
		"vapid_subject": &cfg.VAPIDSubject, "paused": &cfg.Paused,
	}
	if token, err := decoder.Token(); err != nil || token != json.Delim('{') {
		return cfg, errors.New("app configuration entry must be an object")
	}
	for decoder.More() {
		token, err := decoder.Token()
		name, ok := token.(string)
		field := fields[name]
		if err != nil || !ok || field == nil {
			return cfg, errors.New("unknown or repeated app configuration field")
		}
		delete(fields, name)
		var value json.RawMessage
		if err := decoder.Decode(&value); err != nil || bytes.Equal(value, []byte("null")) || json.Unmarshal(value, field) != nil {
			return cfg, errors.New("app configuration field has an invalid value")
		}
	}
	if token, err := decoder.Token(); err != nil || token != json.Delim('}') || webpush.ValidateAppID(cfg.ID) != nil {
		return cfg, errors.New("app configuration entry is invalid")
	}
	return cfg, nil
}
