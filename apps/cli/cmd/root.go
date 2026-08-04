package cmd

import (
	"github.com/spf13/cobra"
)

var rootCmd = &cobra.Command{
	Use:   "saecula-cli",
	Short: "Saecula data pipeline: scrape sources into generic JSON, then seed the databases",
	Long: `saecula-cli is a two-stage pipeline with a clean separation:

  1. scrape           : download a source into ONE generic JSON document.
                        No database involved. Sources: bible (CEE),
                        readings (USCCB daily Mass readings).
  2. seed             : load generic JSON documents into PostgreSQL
                        (localized texts) and Neo4j (concept graph).

In a terminal with no arguments it starts the interactive wizard
(also: saecula-cli interactive); otherwise it scrapes the CEE Bible
(historical default).`,
	// The --out flag is registered on the root command in scrape.go's init().
	RunE: func(cmd *cobra.Command, args []string) error {
		// A human at the keyboard with no explicit flags → guided mode.
		if isTTY() && !cmd.Flags().Changed("out") {
			return runInteractive(cmd, args)
		}
		return runScrapeBible(cmd, args)
	},
	SilenceUsage: true,
}

func Execute() error {
	return rootCmd.Execute()
}
