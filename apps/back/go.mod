module saecula/back

go 1.25.0

require (
	github.com/go-chi/chi/v5 v5.1.0
	github.com/golang-jwt/jwt/v5 v5.2.1
	github.com/google/uuid v1.6.0
	github.com/jackc/pgx/v5 v5.7.5
	github.com/neo4j/neo4j-go-driver/v5 v5.28.0
	golang.org/x/crypto v0.40.0
)

require saecula/canon v0.0.0

require github.com/firebase/genkit/go v1.11.0 // indirect

replace saecula/canon => ../../libs/canon
