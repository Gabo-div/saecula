package scrape

import (
	"context"
	"crypto/sha256"
	"fmt"
	"io"
	"math/bits"
	"net/http"
	"regexp"
	"strconv"
	"sync"
	"time"
)

// bible.usccb.org sits behind an "Obolus" proof-of-work bot wall: a request
// without a valid proof cookie is answered, at random, with a 403 whose body
// is a JS challenge. The challenge asks the client to mine a nonce N such
// that SHA-256("<nonce>:mine:<N>") has at least <difficulty> leading zero
// bits, then present the cookie
//
//	X_Obolus_Proof = <challengeTimestamp>:<nonce>:<challengeToken>:<benchmarkElapsed>:<N>
//
// The server signed <challengeToken> itself, so it only re-checks the token
// and the mined bits — benchmarkElapsed is not validated (we send 0). One
// solved proof is accepted for every page on the host until it expires
// (~30 min), turning a slow, ~50%-failing scrape into a reliable one.
//
// ObolusFetcher wraps another Fetcher-like HTTP layer, transparently solving
// and caching the proof. It is safe for concurrent use.
type ObolusFetcher struct {
	client    *http.Client
	userAgent string

	mu    sync.Mutex
	proof string // cached X_Obolus_Proof cookie value
}

var _ Fetcher = (*ObolusFetcher)(nil)

// A browser-like User-Agent: the bot wall rejects obviously scripted ones.
const obolusUserAgent = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 " +
	"(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"

func NewObolusFetcher(client *http.Client) *ObolusFetcher {
	if client == nil {
		client = &http.Client{Timeout: 30 * time.Second}
	}
	return &ObolusFetcher{client: client, userAgent: obolusUserAgent}
}

// Fetch returns the page body, solving the proof-of-work challenge on demand
// and reusing the resulting proof across calls. A challenge met with the
// cached proof is re-solved once.
func (f *ObolusFetcher) Fetch(ctx context.Context, url string) (io.ReadCloser, error) {
	body, status, err := f.do(ctx, url, f.currentProof())
	if err != nil {
		return nil, err
	}
	if status == http.StatusOK {
		return body, nil
	}

	// A 403 carries the challenge; anything else is a real error.
	challenge, _ := io.ReadAll(body)
	body.Close()
	if status != http.StatusForbidden {
		return nil, fmt.Errorf("unexpected status %d", status)
	}

	proof, err := solveObolus(challenge)
	if err != nil {
		return nil, fmt.Errorf("solve obolus challenge: %w", err)
	}
	f.setProof(proof)

	body, status, err = f.do(ctx, url, proof)
	if err != nil {
		return nil, err
	}
	if status != http.StatusOK {
		body.Close()
		return nil, fmt.Errorf("unexpected status %d after solving challenge", status)
	}
	return body, nil
}

func (f *ObolusFetcher) currentProof() string {
	f.mu.Lock()
	defer f.mu.Unlock()
	return f.proof
}

func (f *ObolusFetcher) setProof(p string) {
	f.mu.Lock()
	f.proof = p
	f.mu.Unlock()
}

// do issues one request, attaching the proof cookie when present. The caller
// owns the returned body.
func (f *ObolusFetcher) do(ctx context.Context, url, proof string) (io.ReadCloser, int, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, 0, err
	}
	req.Header.Set("User-Agent", f.userAgent)
	req.Header.Set("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")
	if proof != "" {
		req.Header.Set("Cookie", obolusCookieName+"="+proof)
	}
	resp, err := f.client.Do(req)
	if err != nil {
		return nil, 0, err
	}
	return resp.Body, resp.StatusCode, nil
}

const obolusCookieName = "X_Obolus_Proof"

var (
	reObolusNonce      = regexp.MustCompile(`nonce:\s*'([0-9a-fA-F]+)'`)
	reObolusToken      = regexp.MustCompile(`challengeToken:\s*'([0-9a-fA-F]+)'`)
	reObolusTimestamp  = regexp.MustCompile(`challengeTimestamp:\s*'(\d+)'`)
	reObolusDifficulty = regexp.MustCompile(`difficulty:\s*'(\d+)'`)
)

// obolus difficulty is clamped: the floor mirrors the challenge's own
// BASELINE_DIFFICULTY, the ceiling caps mining time (2^20 hashes ≈ a second)
// against a hostile difficulty value.
const (
	obolusMinDifficulty = 12
	obolusMaxDifficulty = 20
)

// solveObolus parses the JS challenge body and mines the proof cookie.
func solveObolus(challenge []byte) (string, error) {
	body := string(challenge)
	nonce := firstSubmatch(reObolusNonce, body)
	token := firstSubmatch(reObolusToken, body)
	timestamp := firstSubmatch(reObolusTimestamp, body)
	if nonce == "" || token == "" || timestamp == "" {
		return "", fmt.Errorf("challenge fields not found — the bot wall may have changed")
	}

	difficulty := obolusMinDifficulty
	if d, err := strconv.Atoi(firstSubmatch(reObolusDifficulty, body)); err == nil {
		difficulty = d
	}
	if difficulty < obolusMinDifficulty {
		difficulty = obolusMinDifficulty
	}
	if difficulty > obolusMaxDifficulty {
		return "", fmt.Errorf("challenge difficulty %d exceeds cap %d", difficulty, obolusMaxDifficulty)
	}

	miningNonce := mineObolus(nonce, difficulty)
	// Field order the server expects; benchmarkElapsed (0) is unchecked.
	return fmt.Sprintf("%s:%s:%s:0:%d", timestamp, nonce, token, miningNonce), nil
}

// mineObolus finds the smallest N with SHA-256("<nonce>:mine:<N>") having at
// least difficulty leading zero bits.
func mineObolus(nonce string, difficulty int) int {
	prefix := nonce + ":mine:"
	for n := 0; ; n++ {
		sum := sha256.Sum256([]byte(prefix + strconv.Itoa(n)))
		if leadingZeroBits(sum[:]) >= difficulty {
			return n
		}
	}
}

// leadingZeroBits counts the leading zero bits of a byte slice.
func leadingZeroBits(h []byte) int {
	n := 0
	for _, b := range h {
		if b == 0 {
			n += 8
			continue
		}
		n += bits.LeadingZeros8(b)
		break
	}
	return n
}

func firstSubmatch(re *regexp.Regexp, s string) string {
	if m := re.FindStringSubmatch(s); m != nil {
		return m[1]
	}
	return ""
}
