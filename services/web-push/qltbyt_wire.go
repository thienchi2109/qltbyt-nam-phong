package webpush

// QLTBYT v1 DTOs belong to the HTTP adapter; Backend uses plain Go contracts.
type qltbytClaimRequest struct {
	Version          int    `json:"version"`
	WorkerID         string `json:"worker_id"`
	Limit            int    `json:"limit"`
	VAPIDKeyVersion  string `json:"vapid_key_version"`
	VAPIDFingerprint string `json:"vapid_fingerprint"`
}

type qltbytClaimResponse struct {
	Version          int              `json:"version"`
	ServerTime       string           `json:"server_time"`
	PollAfterSeconds int              `json:"poll_after_seconds"`
	Deliveries       []qltbytDelivery `json:"deliveries"`
}

type qltbytDelivery struct {
	DeliveryID           string                 `json:"delivery_id"`
	AttemptToken         string                 `json:"attempt_token"`
	Attempt              int                    `json:"attempt"`
	SubscriptionID       string                 `json:"subscription_id"`
	SubscriptionRevision string                 `json:"subscription_revision"`
	LeaseExpiresAt       string                 `json:"lease_expires_at"`
	Deadline             string                 `json:"deadline"`
	TTLSeconds           int                    `json:"ttl_seconds"`
	VAPIDKeyVersion      string                 `json:"vapid_key_version"`
	Endpoint             string                 `json:"endpoint"`
	Keys                 qltbytSubscriptionKeys `json:"keys"`
	PayloadBase64        string                 `json:"payload_base64"`
}

type qltbytSubscriptionKeys struct {
	P256DH string `json:"p256dh"`
	Auth   string `json:"auth"`
}

type qltbytReportRequest struct {
	Version int                `json:"version"`
	Results []qltbytReportItem `json:"results"`
}

type qltbytReportItem struct {
	DeliveryID           string `json:"delivery_id"`
	AttemptToken         string `json:"attempt_token"`
	SubscriptionRevision string `json:"subscription_revision"`
	Outcome              string `json:"outcome"`
	ProviderStatus       *int   `json:"provider_status"`
	RetryAfterSeconds    *int   `json:"retry_after_seconds"`
}

type qltbytReportResponse struct {
	Version int                  `json:"version"`
	Results []qltbytReportResult `json:"results"`
}

type qltbytReportResult struct {
	DeliveryID string `json:"delivery_id"`
	Result     string `json:"result"`
}

func (response qltbytClaimResponse) core() ClaimResponse {
	deliveries := make([]Delivery, len(response.Deliveries))
	for index, item := range response.Deliveries {
		deliveries[index] = Delivery{
			DeliveryID: item.DeliveryID, AttemptToken: item.AttemptToken, Attempt: item.Attempt,
			SubscriptionID: item.SubscriptionID, SubscriptionRevision: item.SubscriptionRevision,
			LeaseExpiresAt: item.LeaseExpiresAt, Deadline: item.Deadline, TTLSeconds: item.TTLSeconds,
			VAPIDKeyVersion: item.VAPIDKeyVersion, Endpoint: item.Endpoint,
			Keys: SubscriptionKeys{P256DH: item.Keys.P256DH, Auth: item.Keys.Auth}, PayloadBase64: item.PayloadBase64,
		}
	}
	return ClaimResponse{ServerTime: response.ServerTime, PollAfterSeconds: response.PollAfterSeconds, Deliveries: deliveries}
}

func qltbytReport(request ReportRequest) qltbytReportRequest {
	results := make([]qltbytReportItem, len(request.Results))
	for index, item := range request.Results {
		results[index] = qltbytReportItem{
			DeliveryID: item.DeliveryID, AttemptToken: item.AttemptToken, SubscriptionRevision: item.SubscriptionRevision,
			Outcome: item.Outcome, ProviderStatus: item.ProviderStatus, RetryAfterSeconds: item.RetryAfterSeconds,
		}
	}
	return qltbytReportRequest{Version: 1, Results: results}
}

func (response qltbytReportResponse) core() ReportResponse {
	results := make([]ReportResult, len(response.Results))
	for index, item := range response.Results {
		results[index] = ReportResult{DeliveryID: item.DeliveryID, Result: item.Result}
	}
	return ReportResponse{Results: results}
}
