package main

import (
	"os"

	"saecula/cli/cmd"
	"saecula/env"
)

func main() {
	env.Load() // shared root .env; real shell env still wins
	if err := cmd.Execute(); err != nil {
		os.Exit(1)
	}
}
