package ingress

// Admission bounds concurrent requests before any provider work begins.
type Admission struct {
	slots  chan struct{}
	reject bool
}

// NewAdmission creates a bounded request gate. Non-positive limits are invalid
// and produce a closed gate that rejects every request.
func NewAdmission(maxConcurrent int) *Admission {
	if maxConcurrent <= 0 {
		return &Admission{reject: true}
	}
	return &Admission{slots: make(chan struct{}, maxConcurrent)}
}

func (a *Admission) acquire() bool {
	if a == nil {
		return false
	}
	if a.reject {
		return false
	}
	if a.slots == nil {
		return true
	}
	select {
	case a.slots <- struct{}{}:
		return true
	default:
		return false
	}
}

func (a *Admission) release() {
	if a == nil || a.slots == nil {
		return
	}
	<-a.slots
}

func (a *Admission) ready() bool {
	return a != nil && !a.reject && a.slots != nil
}
