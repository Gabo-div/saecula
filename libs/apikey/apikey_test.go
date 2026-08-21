package apikey

import "testing"

func TestGenerate(t *testing.T) {
	plain, hash, public, err := Generate()
	if err != nil {
		t.Fatalf("Generate: %v", err)
	}
	if !WellFormed(plain) {
		t.Errorf("generated key is not well-formed: %q", plain)
	}
	if got := Hash(plain); got != hash {
		t.Errorf("Hash(plaintext) = %q, want the returned hash %q", got, hash)
	}
	if len(hash) != 64 {
		t.Errorf("hash length = %d, want 64 hex chars", len(hash))
	}
	if public != plain[:PublicLen] {
		t.Errorf("public = %q, want prefix of plaintext %q", public, plain[:PublicLen])
	}
	if len(public) >= len(plain) {
		t.Errorf("public fragment %q is not shorter than the secret", public)
	}

	other, _, _, err := Generate()
	if err != nil {
		t.Fatalf("Generate: %v", err)
	}
	if other == plain {
		t.Error("two generated keys are identical")
	}
}

func TestWellFormedRejects(t *testing.T) {
	for _, s := range []string{"", "sk_saecula_", "sk_saecula_abc", "nope", Prefix[:5]} {
		if WellFormed(s) {
			t.Errorf("WellFormed(%q) = true, want false", s)
		}
	}
}
