// Package env loads a single shared .env from the repository root into the
// process environment, so every Go app (backend, CLI) reads the same file the
// mobile app does. Variables already present in the real environment are never
// overridden, so a shell `export` still wins over the file.
package env

import (
	"bufio"
	"os"
	"path/filepath"
	"strings"
)

// Load finds the nearest .env by walking up from the working directory to the
// filesystem root and applies its KEY=VALUE lines. A missing file is not an
// error. ponytail: no interpolation or multi-line values — plain KEY=VALUE.
func Load() {
	path, ok := findUp(".env")
	if !ok {
		return
	}
	f, err := os.Open(path)
	if err != nil {
		return
	}
	defer f.Close()

	sc := bufio.NewScanner(f)
	for sc.Scan() {
		line := strings.TrimSpace(sc.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		line = strings.TrimPrefix(line, "export ")
		eq := strings.IndexByte(line, '=')
		if eq < 0 {
			continue
		}
		key := strings.TrimSpace(line[:eq])
		if key == "" {
			continue
		}
		if _, exists := os.LookupEnv(key); exists {
			continue // a real shell export wins over the file
		}
		_ = os.Setenv(key, unquote(strings.TrimSpace(line[eq+1:])))
	}
}

func findUp(name string) (string, bool) {
	dir, err := os.Getwd()
	if err != nil {
		return "", false
	}
	for {
		p := filepath.Join(dir, name)
		if _, err := os.Stat(p); err == nil {
			return p, true
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			return "", false
		}
		dir = parent
	}
}

func unquote(s string) string {
	if len(s) >= 2 {
		if (s[0] == '"' && s[len(s)-1] == '"') || (s[0] == '\'' && s[len(s)-1] == '\'') {
			return s[1 : len(s)-1]
		}
	}
	return s
}
