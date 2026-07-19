module saecula/back

go 1.23

require (
	github.com/go-chi/chi/v5 v5.1.0
	github.com/golang-jwt/jwt/v5 v5.2.1
	github.com/google/uuid v1.6.0
	github.com/jackc/pgx/v5 v5.7.2
	github.com/neo4j/neo4j-go-driver/v5 v5.28.0
	golang.org/x/crypto v0.31.0
)

require saecula/canon v0.0.0

replace saecula/canon => ../../libs/canon
