import { createKnowledgeGraphProvider } from './mcp-knowledge-graph.js'

export function createNeo4jMemoryProvider(registration) {
  return createKnowledgeGraphProvider({ ...registration, id: registration?.id || 'neo4j-memory' })
}
