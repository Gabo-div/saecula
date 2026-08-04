package scrape

import (
	"crypto/sha256"
	"strconv"
	"strings"
	"testing"
)

func TestMineObolus(t *testing.T) {
	const nonce = "fd547aba9cbc2862"
	for _, difficulty := range []int{8, 12, 14} {
		n := mineObolus(nonce, difficulty)
		sum := sha256.Sum256([]byte(nonce + ":mine:" + strconv.Itoa(n)))
		if got := leadingZeroBits(sum[:]); got < difficulty {
			t.Fatalf("mineObolus(diff=%d) = %d has %d leading zero bits, want >= %d",
				difficulty, n, got, difficulty)
		}
		// It must be the SMALLEST such nonce: no earlier n qualifies.
		for i := 0; i < n; i++ {
			s := sha256.Sum256([]byte(nonce + ":mine:" + strconv.Itoa(i)))
			if leadingZeroBits(s[:]) >= difficulty {
				t.Fatalf("mineObolus(diff=%d) = %d not minimal; %d also qualifies", difficulty, n, i)
			}
		}
	}
}

func TestLeadingZeroBits(t *testing.T) {
	cases := []struct {
		in   []byte
		want int
	}{
		{[]byte{0xFF}, 0},
		{[]byte{0x7F}, 1},
		{[]byte{0x0F}, 4},
		{[]byte{0x00, 0x80}, 8},
		{[]byte{0x00, 0x00, 0x01}, 23},
	}
	for _, c := range cases {
		if got := leadingZeroBits(c.in); got != c.want {
			t.Fatalf("leadingZeroBits(% x) = %d, want %d", c.in, got, c.want)
		}
	}
}

func TestSolveObolus(t *testing.T) {
	// A minimal challenge body carrying the four CONFIG fields the solver
	// reads, in the real page's format.
	challenge := `
	const CONFIG = {
      nonce: 'fd547aba9cbc2862',
      challengeToken: '898995022ca738392e4851b9407fe68f58c18a2c30e8226416e0b7da9e84bcd3',
      challengeTimestamp: '1784494955',
      difficulty: '12',
    };`

	proof, err := solveObolus([]byte(challenge))
	if err != nil {
		t.Fatalf("solveObolus: %v", err)
	}

	// Cookie shape: ts:nonce:token:benchmarkElapsed:miningNonce
	parts := strings.Split(proof, ":")
	if len(parts) != 5 {
		t.Fatalf("proof = %q, want 5 colon-separated fields", proof)
	}
	if parts[0] != "1784494955" || parts[1] != "fd547aba9cbc2862" {
		t.Fatalf("proof carries wrong timestamp/nonce: %q", proof)
	}
	if parts[3] != "0" {
		t.Fatalf("benchmarkElapsed field = %q, want 0", parts[3])
	}
	mn, err := strconv.Atoi(parts[4])
	if err != nil {
		t.Fatalf("mining nonce %q not an integer", parts[4])
	}
	sum := sha256.Sum256([]byte(parts[1] + ":mine:" + strconv.Itoa(mn)))
	if leadingZeroBits(sum[:]) < 12 {
		t.Fatalf("mined nonce does not satisfy difficulty 12")
	}
}

func TestSolveObolusMissingFields(t *testing.T) {
	if _, err := solveObolus([]byte("no challenge here")); err == nil {
		t.Fatal("expected error for challenge without CONFIG fields")
	}
}

func TestSolveObolusDifficultyCap(t *testing.T) {
	challenge := `nonce: 'abcd', challengeToken: 'ffff', challengeTimestamp: '1', difficulty: '99'`
	if _, err := solveObolus([]byte(challenge)); err == nil {
		t.Fatal("expected error for difficulty above the cap")
	}
}
