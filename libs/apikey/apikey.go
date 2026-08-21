// Package apikey mints and hashes the API keys that authenticate the public
// MCP endpoint. It lives in libs/ because two modules derive the same hash
// from a key: the backend verifies incoming keys, and the CLI seeds the dev
// key — they must agree on the scheme or the seeded key never authenticates.
package apikey

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"fmt"
	"strings"
)

// Prefix marks every key, so a leaked string is recognizable as ours by secret
// scanners and by us in logs.
const Prefix = "sk_saecula_"

// secretBytes is the entropy behind a key. 256 bits is far past brute force,
// which is why Hash is a plain SHA-256 and not a slow password KDF: there is
// no low-entropy guess to slow down, and the hash sits in the hot path of
// every tool call.
const secretBytes = 32

// PublicLen is how much of a key is stored in the clear, so a user can tell
// their keys apart in a listing without us keeping the secret.
const PublicLen = len(Prefix) + 6

// Generate mints a key. The plaintext is returned once, to be shown to its
// owner and never persisted; only Hash and Public belong in the database.
func Generate() (plaintext, hash, public string, err error) {
	buf := make([]byte, secretBytes)
	if _, err := rand.Read(buf); err != nil {
		return "", "", "", fmt.Errorf("read random: %w", err)
	}
	plaintext = Prefix + base64.RawURLEncoding.EncodeToString(buf)
	return plaintext, Hash(plaintext), Public(plaintext), nil
}

// Hash is the lookup value stored in api_keys.key_hash.
func Hash(plaintext string) string {
	sum := sha256.Sum256([]byte(plaintext))
	return hex.EncodeToString(sum[:])
}

// Public is the non-secret fragment shown in listings, e.g. "sk_saecula_Ab3dEf".
func Public(plaintext string) string {
	if len(plaintext) < PublicLen {
		return plaintext
	}
	return plaintext[:PublicLen]
}

// WellFormed reports whether s has the shape of a Saecula key. It is a cheap
// filter that keeps malformed credentials from reaching the database on a
// public endpoint — not a validity check.
func WellFormed(s string) bool {
	return strings.HasPrefix(s, Prefix) && len(s) > PublicLen
}
