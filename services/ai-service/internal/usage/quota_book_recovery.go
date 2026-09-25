package usage

import "strconv"

func (b *QuotaBook) reload() error {
	lines, err := readJournal(b.journalPath())
	if err != nil {
		return err
	}
	b.slots = map[string]*quotaSlot{}
	b.byReq = map[string]string{}
	for _, line := range lines {
		slot := b.ensure(line)
		switch line.Kind {
		case kindProviderIntent:
			if line.AttemptID == "" {
				continue
			}
			if _, ok := slot.intents[line.AttemptID]; !ok {
				slot.attemptOrder = append(slot.attemptOrder, line.AttemptID)
			}
			slot.intents[line.AttemptID] = struct{}{}
			if attempt, err := strconv.Atoi(line.AttemptID); err == nil && attempt > slot.started {
				slot.started = attempt
			}
		case kindUsageObserved:
			if slot.usages == nil {
				slot.usages = map[string]CallUsage{}
			}
			slot.usages[line.AttemptID] = callFromLine(line)
		case kindFinalized:
			record := reconciliationFromLine(line)
			slot.final = &record
		case kindExpired:
			record := reconciliationFromLine(line)
			record.Status = StatusExpiredUncertain
			record.Uncertainty = UncertaintyExpired
			record.Measured = false
			record.Refund = false
			record.InputTokens = nil
			record.OutputTokens = nil
			record.Knowledge = KnowledgeUnknown
			slot.final = &record
		}
	}
	return nil
}

func (b *QuotaBook) ensure(line journalLine) *quotaSlot {
	slot := b.slots[line.ReservationID]
	if slot == nil {
		slot = &quotaSlot{intents: map[string]struct{}{}, pendingIntents: map[string]struct{}{}, usages: map[string]CallUsage{}, pending: map[string]CallUsage{}}
		b.slots[line.ReservationID] = slot
	}
	if line.RequestID != "" {
		slot.requestID = line.RequestID
		b.byReq[line.RequestID] = line.ReservationID
	}
	if parsed := parseExpiry(line.ExpiresAt); !parsed.IsZero() {
		slot.expires = parsed
	}
	return slot
}
