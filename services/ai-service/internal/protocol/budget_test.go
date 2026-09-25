package protocol

import (
	"testing"
	"time"
)

func TestRequestBudgetIsNotSummedWithDrainGrace(t *testing.T) {
	if WorkBudget != 55*time.Second {
		t.Fatalf("work budget = %s", WorkBudget)
	}
	if CleanupBudget != 5*time.Second {
		t.Fatalf("cleanup = %s", CleanupBudget)
	}
	if RouteBudget != 60*time.Second {
		t.Fatalf("route budget = %s", RouteBudget)
	}
	if RouteBudget != WorkBudget+CleanupBudget {
		t.Fatalf("route budget = %s", RouteBudget)
	}
	if ReservationTTL < 120*time.Second || ReservationTTL <= WorkBudget+CleanupBudget {
		t.Fatalf("reservation ttl = %s", ReservationTTL)
	}
	if DrainGraceMin != 60*time.Second || DrainGraceMax != 90*time.Second {
		t.Fatalf("drain grace = %s..%s", DrainGraceMin, DrainGraceMax)
	}
	if DrainGraceMin < 60*time.Second || DrainGraceMax > 90*time.Second || DrainGraceMin > DrainGraceMax {
		t.Fatal("drain grace ceiling is outside 60s..90s")
	}
	withDrain := WorkBudget + DrainGraceMin
	if withDrain == WorkBudget || withDrain == RouteBudget || WorkBudget >= DrainGraceMin {
		t.Fatal("drain grace was added to the work deadline")
	}
}
