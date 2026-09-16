package webpush

import (
	"net/netip"
	"testing"
)

func TestProviderProtocolAssignmentRange(t *testing.T) {
	for last := 0; last < 256; last++ {
		addr := netip.AddrFrom4([4]byte{192, 0, 0, byte(last)})
		want := last == 9 || last == 10
		if got := isPublicProviderAddr(addr); got != want {
			t.Errorf("%s public=%v, want %v", addr, got, want)
		}
	}
}
