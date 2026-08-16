package env

import (
	"os"
	"path/filepath"
	"testing"
)

func TestLoad(t *testing.T) {
	dir := t.TempDir()
	content := "# a comment\n\nexport FOO=bar\nQUOTED=\"hello world\"\nSHELL_WINS=fromfile\nno_equals_line\n"
	if err := os.WriteFile(filepath.Join(dir, ".env"), []byte(content), 0o600); err != nil {
		t.Fatal(err)
	}

	os.Setenv("SHELL_WINS", "fromshell")
	t.Cleanup(func() {
		os.Unsetenv("SHELL_WINS")
		os.Unsetenv("FOO")
		os.Unsetenv("QUOTED")
	})

	old, _ := os.Getwd()
	if err := os.Chdir(dir); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = os.Chdir(old) })

	Load()

	if got := os.Getenv("FOO"); got != "bar" {
		t.Errorf("FOO = %q, want bar (export prefix stripped)", got)
	}
	if got := os.Getenv("QUOTED"); got != "hello world" {
		t.Errorf("QUOTED = %q, want 'hello world' (quotes stripped)", got)
	}
	if got := os.Getenv("SHELL_WINS"); got != "fromshell" {
		t.Errorf("SHELL_WINS = %q, want fromshell (real env must win)", got)
	}
}
