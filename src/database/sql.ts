export type SqlMigration = {
	description: string;
	sql: string;
}

export const migrations: Record<string, SqlMigration> = {
	vector: {
		description: "Creates vector tables and indexes for different models",
		sql: `
            -- Enable required extensions
            CREATE EXTENSION IF NOT EXISTS vector;

            -- Create vector tables for different models
            CREATE TABLE IF NOT EXISTS "embeddings_1536" (
                "id" serial PRIMARY KEY NOT NULL,
                "path" text NOT NULL,
                "mtime" bigint NOT NULL,
                "content" text NOT NULL,
                "embedding" vector(1536),
                "metadata" jsonb NOT NULL
            );

			CREATE TABLE IF NOT EXISTS "embeddings_1024" (
				"id" serial PRIMARY KEY NOT NULL,
				"path" text NOT NULL,
				"mtime" bigint NOT NULL,
				"content" text NOT NULL,
				"embedding" vector(1024),
				"metadata" jsonb NOT NULL
			);

            CREATE TABLE IF NOT EXISTS "embeddings_768" (
                "id" serial PRIMARY KEY NOT NULL,
                "path" text NOT NULL,
                "mtime" bigint NOT NULL,
                "content" text NOT NULL,
                "embedding" vector(768),
                "metadata" jsonb NOT NULL
            );

			CREATE TABLE IF NOT EXISTS "embeddings_512" (
                "id" serial PRIMARY KEY NOT NULL,
                "path" text NOT NULL,
                "mtime" bigint NOT NULL,
                "content" text NOT NULL,
                "embedding" vector(512),
                "metadata" jsonb NOT NULL
            );

			CREATE TABLE IF NOT EXISTS "embeddings_384" (
                "id" serial PRIMARY KEY NOT NULL,
                "path" text NOT NULL,
                "mtime" bigint NOT NULL,
                "content" text NOT NULL,
                "embedding" vector(384),
                "metadata" jsonb NOT NULL
            );

            -- Create HNSW indexes for vector similarity search
            CREATE INDEX IF NOT EXISTS "embeddingIndex_1536" 
            ON "embeddings_1536" 
            USING hnsw ("embedding" vector_cosine_ops);

            CREATE INDEX IF NOT EXISTS "embeddingIndex_1024" 
            ON "embeddings_1024" 
            USING hnsw ("embedding" vector_cosine_ops);

			CREATE INDEX IF NOT EXISTS "embeddingIndex_768"
            ON "embeddings_768" 
            USING hnsw ("embedding" vector_cosine_ops);

			CREATE INDEX IF NOT EXISTS "embeddingIndex_512"
			ON "embeddings_512"
			USING hnsw ("embedding" vector_cosine_ops);

			CREATE INDEX IF NOT EXISTS "embeddingIndex_384"
			ON "embeddings_384"
			USING hnsw ("embedding" vector_cosine_ops);

            -- Create B-tree indexes for path field to optimize file path queries
            CREATE INDEX IF NOT EXISTS "pathIndex_1536" 
            ON "embeddings_1536" ("path");

            CREATE INDEX IF NOT EXISTS "pathIndex_1024" 
            ON "embeddings_1024" ("path");

            CREATE INDEX IF NOT EXISTS "pathIndex_768" 
            ON "embeddings_768" ("path");

            CREATE INDEX IF NOT EXISTS "pathIndex_512" 
            ON "embeddings_512" ("path");

            CREATE INDEX IF NOT EXISTS "pathIndex_384" 
            ON "embeddings_384" ("path");
        `
	},
	template: {
		description: "Creates template table with UUID support",
		sql: `
            -- Create template table
            CREATE TABLE IF NOT EXISTS "template" (
                "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
                "name" text NOT NULL,
                "content" jsonb NOT NULL,
                "created_at" timestamp DEFAULT now() NOT NULL,
                "updated_at" timestamp DEFAULT now() NOT NULL,
                CONSTRAINT "template_name_unique" UNIQUE("name")
            );
        `
	},
	conversation: {
		description: "Creates conversations and messages tables",
		sql: `
            CREATE TABLE IF NOT EXISTS "conversations" (
                "id" uuid PRIMARY KEY NOT NULL,
                "title" text NOT NULL,
                "created_at" timestamp DEFAULT now() NOT NULL,
                "updated_at" timestamp DEFAULT now() NOT NULL
            );

            CREATE TABLE IF NOT EXISTS "messages" (
                "id" uuid PRIMARY KEY NOT NULL,
                "conversation_id" uuid NOT NULL REFERENCES "conversations"("id") ON DELETE CASCADE,
								"apply_status" integer NOT NULL DEFAULT 0,
                "role" text NOT NULL,
                "content" text,
                "reasoning_content" text,
                "prompt_content" text,
                "metadata" text,
                "mentionables" text,
                "similarity_search_results" text,
                "created_at" timestamp DEFAULT now() NOT NULL
            );
        `
	}
};
