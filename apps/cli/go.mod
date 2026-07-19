module saecula/cli

go 1.23

require (
	charm.land/huh/v2 v2.0.0
	github.com/PuerkitoBio/goquery v1.10.1
	github.com/jackc/pgx/v5 v5.7.2
	github.com/neo4j/neo4j-go-driver/v5 v5.28.0
	github.com/spf13/cobra v1.8.1
	github.com/spf13/pflag v1.0.5
)

require (
	github.com/andybalholm/cascadia v1.3.3 // indirect
	github.com/inconshreveable/mousetrap v1.1.0 // indirect
	github.com/jackc/pgpassfile v1.0.0 // indirect
	github.com/jackc/pgservicefile v0.0.0-20240606120523-5a60cdf6a761 // indirect
	github.com/jackc/puddle/v2 v2.2.2 // indirect
	golang.org/x/crypto v0.31.0 // indirect
	golang.org/x/net v0.33.0 // indirect
	golang.org/x/sync v0.10.0 // indirect
	golang.org/x/text v0.21.0 // indirect
)

require saecula/canon v0.0.0

replace saecula/canon => ../../libs/canon
