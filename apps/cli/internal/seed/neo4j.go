package seed

import (
	"context"
	"fmt"

	"github.com/neo4j/neo4j-go-driver/v5/neo4j"
)

// Batch sizes keep every transaction small enough to stay well under the
// driver's retry/timeout limits, even for whole-Bible seeds (~35k nodes).
const (
	nodeChunkSize = 2000
	relChunkSize  = 5000
)

// Neo4jGraphStore is the driver-backed GraphStore. The driver is injected —
// this type never opens its own connections. Named for the neo4j-go-driver
// (the Bolt/Cypher driver), which also drives Memgraph.
type Neo4jGraphStore struct {
	driver neo4j.DriverWithContext
	// labels whose id index has been ensured this run. Unlike Neo4j, a
	// Memgraph uniqueness constraint does NOT create a backing index, so
	// MERGE by id would degrade to a full label scan per row without one.
	indexed map[string]bool
}

var _ GraphStore = (*Neo4jGraphStore)(nil)

func NewNeo4jGraphStore(driver neo4j.DriverWithContext) *Neo4jGraphStore {
	return &Neo4jGraphStore{driver: driver, indexed: map[string]bool{}}
}

// ensureIndex creates the per-label index on id that MERGE relies on.
// Memgraph treats CREATE INDEX on an existing index as a no-op, so this is
// safe to re-run across seeds. Index DDL is rejected inside a managed
// transaction ("not allowed in multicommand transactions"), so it runs via
// session.Run — an implicit, auto-committing transaction.
func (s *Neo4jGraphStore) ensureIndex(ctx context.Context, label string) error {
	if s.indexed[label] {
		return nil
	}
	session := s.driver.NewSession(ctx, neo4j.SessionConfig{AccessMode: neo4j.AccessModeWrite})
	defer func() { _ = session.Close(ctx) }()

	query := fmt.Sprintf(`CREATE INDEX ON :%s(id)`, label)
	result, err := session.Run(ctx, query, nil)
	if err != nil {
		return fmt.Errorf("ensure %s id index: %w", label, err)
	}
	if _, err := result.Consume(ctx); err != nil {
		return fmt.Errorf("ensure %s id index: %w", label, err)
	}
	s.indexed[label] = true
	return nil
}

// MergeNodes upserts concept nodes grouped by label (Cypher cannot
// parameterize labels), in chunks, after ensuring the id index exists.
func (s *Neo4jGraphStore) MergeNodes(ctx context.Context, nodes []GraphNode) error {
	byLabel := map[string][]map[string]any{}
	for _, n := range nodes {
		byLabel[n.Label] = append(byLabel[n.Label], map[string]any{
			"id":    n.ID,
			"props": n.Props,
		})
	}

	for label, batch := range byLabel {
		if err := s.ensureIndex(ctx, label); err != nil {
			return err
		}
		query := fmt.Sprintf(`
			UNWIND $nodes AS node
			MERGE (n:%s {id: node.id})
			SET n += node.props`, label)

		for _, chunk := range chunks(batch, nodeChunkSize) {
			if _, err := neo4j.ExecuteQuery(ctx, s.driver, query,
				map[string]any{"nodes": chunk}, neo4j.EagerResultTransformer); err != nil {
				return fmt.Errorf("merge %s nodes: %w", label, err)
			}
		}
	}
	return nil
}

// MergeRelationships upserts edges grouped by (fromLabel, type, toLabel),
// in chunks. Targets are MERGEd as stubs so edges survive out-of-order
// seeding.
func (s *Neo4jGraphStore) MergeRelationships(ctx context.Context, rels []Relationship) error {
	type relKey struct{ from, typ, to string }
	grouped := map[relKey][]map[string]any{}
	for _, r := range rels {
		key := relKey{from: r.FromLabel, typ: r.Type, to: r.ToLabel}
		grouped[key] = append(grouped[key], map[string]any{
			"from": r.FromID,
			"to":   r.ToID,
		})
	}

	for key, batch := range grouped {
		if err := s.ensureIndex(ctx, key.from); err != nil {
			return err
		}
		if err := s.ensureIndex(ctx, key.to); err != nil {
			return err
		}
		query := fmt.Sprintf(`
			UNWIND $rels AS rel
			MATCH (a:%s {id: rel.from})
			MERGE (b:%s {id: rel.to})
			MERGE (a)-[:%s]->(b)`, key.from, key.to, key.typ)

		for _, chunk := range chunks(batch, relChunkSize) {
			if _, err := neo4j.ExecuteQuery(ctx, s.driver, query,
				map[string]any{"rels": chunk}, neo4j.EagerResultTransformer); err != nil {
				return fmt.Errorf("merge %s-[%s]->%s: %w", key.from, key.typ, key.to, err)
			}
		}
	}
	return nil
}

// chunks splits items into slices of at most size elements.
func chunks[T any](items []T, size int) [][]T {
	var out [][]T
	for start := 0; start < len(items); start += size {
		end := min(start+size, len(items))
		out = append(out, items[start:end])
	}
	return out
}
