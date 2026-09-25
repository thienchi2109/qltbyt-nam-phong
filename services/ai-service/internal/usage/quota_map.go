package usage

const (
	rpcSuccess        = "success"
	rpcErrorWithUsage = "error_with_usage"
	rpcErrorNoUsage   = "error_no_usage"
)

func quotaRPC(observation Observation) (status string, input int64, output int64) {
	switch observation.Knowledge {
	case KnowledgeKnownZero:
		return rpcSuccess, 0, 0
	case KnowledgeKnownPositive:
		return rpcSuccess, clampToken(observation.InputTokens), clampToken(observation.OutputTokens)
	case KnowledgePartial:
		return rpcErrorWithUsage, clampToken(observation.InputTokens), clampToken(observation.OutputTokens)
	case KnowledgeProviderNotStarted:
		return rpcErrorNoUsage, 0, 0
	default:
		return rpcErrorWithUsage, 0, 0
	}
}

func clampToken(value *int) int64 {
	if value == nil || *value < 0 {
		return 0
	}
	return int64(*value)
}

func uncertaintyFor(knowledge string) string {
	switch knowledge {
	case KnowledgeKnownZero, KnowledgeKnownPositive:
		return UncertaintyMeasured
	case KnowledgePartial:
		return UncertaintyPartial
	case KnowledgeProviderNotStarted:
		return UncertaintyNoProviderWork
	default:
		return UncertaintyUnknown
	}
}

func lineFromCall(reservationID, requestID, attemptID string, call CallUsage) journalLine {
	line := journalLine{
		Kind:          "usage_observed",
		ReservationID: reservationID,
		RequestID:     requestID,
		AttemptID:     attemptID,
		Uncertainty:   uncertaintyFor(Classify(call).Knowledge),
	}
	if call.InputTokens != nil {
		value := int64(*call.InputTokens)
		line.InputTokens = &value
	}
	if call.OutputTokens != nil {
		value := int64(*call.OutputTokens)
		line.OutputTokens = &value
	}
	return line
}

func callFromLine(line journalLine) CallUsage {
	call := CallUsage{ProviderStarted: true}
	if line.InputTokens != nil {
		value := int(*line.InputTokens)
		call.InputTokens = &value
	}
	if line.OutputTokens != nil {
		value := int(*line.OutputTokens)
		call.OutputTokens = &value
	}
	return call
}

func lineFromReconciliation(kind, requestID, rpcStatus string, record Reconciliation) journalLine {
	line := journalLine{
		Kind:          kind,
		ReservationID: record.ReservationID,
		RequestID:     requestID,
		Uncertainty:   record.Uncertainty,
		Knowledge:     record.Knowledge,
		Status:        record.Status,
		RPCStatus:     rpcStatus,
		Attempts:      record.Attempts,
		Measured:      record.Measured,
		Refund:        record.Refund,
	}
	if record.InputTokens != nil {
		value := int64(*record.InputTokens)
		line.InputTokens = &value
	}
	if record.OutputTokens != nil {
		value := int64(*record.OutputTokens)
		line.OutputTokens = &value
	}
	return line
}

func reconciliationFromLine(line journalLine) Reconciliation {
	record := Reconciliation{
		ReservationID: line.ReservationID,
		Status:        line.Status,
		Attempts:      line.Attempts,
		Knowledge:     line.Knowledge,
		Uncertainty:   line.Uncertainty,
		Measured:      line.Measured,
		Refund:        line.Refund,
	}
	if line.InputTokens != nil {
		value := int(*line.InputTokens)
		record.InputTokens = &value
	}
	if line.OutputTokens != nil {
		value := int(*line.OutputTokens)
		record.OutputTokens = &value
	}
	return record
}
