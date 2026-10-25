import os
from datasets import load_dataset
from qdrant_client import QdrantClient
from qdrant_client.http import models
from sentence_transformers import SentenceTransformer

# 1. Configuration
QDRANT_HOST = os.getenv("QDRANT_HOST", "localhost")
QDRANT_PORT = int(os.getenv("QDRANT_PORT", 6333))
COLLECTION_NAME = "devmentor_cs_dataset"

# Load local embedding model (free, runs locally, no API key required)
print("Loading local SentenceTransformer model (all-MiniLM-L6-v2)...")
embedder = SentenceTransformer("all-MiniLM-L6-v2")

client_qdrant = QdrantClient(host=QDRANT_HOST, port=QDRANT_PORT)

def init_qdrant_collection():
    """Ensure Qdrant collection exists with vector size 384 (all-MiniLM-L6-v2)."""
    collections = [col.name for col in client_qdrant.get_collections().collections]
    
    # If collection exists with wrong size, recreate it
    if COLLECTION_NAME in collections:
        client_qdrant.delete_collection(COLLECTION_NAME)
        
    client_qdrant.create_collection(
        collection_name=COLLECTION_NAME,
        vectors_config=models.VectorParams(
            size=384,  # Size for all-MiniLM-L6-v2
            distance=models.Distance.COSINE
        )
    )
    print(f"Created Qdrant collection: {COLLECTION_NAME} (Vector size: 384)")

def run_ingestion(limit: int = 500):
    """Load dataset from Hugging Face and ingest into Qdrant using local embeddings."""
    init_qdrant_collection()
    print("Loading dataset from Hugging Face: iamtarun/python_code_instructions_18k_alpaca...")
    ds = load_dataset("iamtarun/python_code_instructions_18k_alpaca", split="train")

    points = []
    print(f"Processing top {limit} entries for local vector index...")
    
    for idx, item in enumerate(ds):
        if idx >= limit:
            break

        instruction = item.get("instruction", "")
        input_text = item.get("input", "")
        output_text = item.get("output", "")

        combined_text = f"Instruction: {instruction}\nInput: {input_text}\nOutput/Code:\n{output_text}"
        
        # Generate 384-dim vector locally
        vector = embedder.encode(combined_text).tolist()

        points.append(
            models.PointStruct(
                id=idx,
                vector=vector,
                payload={
                    "instruction": instruction,
                    "input": input_text,
                    "output": output_text,
                    "content": combined_text,
                    "source": "python_code_instructions_18k"
                }
            )
        )

        # Batch upsert every 50 records
        if len(points) >= 50:
            client_qdrant.upsert(collection_name=COLLECTION_NAME, points=points)
            print(f"Ingested {idx + 1}/{limit} points into Qdrant...")
            points = []

    if points:
        client_qdrant.upsert(collection_name=COLLECTION_NAME, points=points)
        print(f"Ingestion complete. Total points in Qdrant: {min(limit, len(ds))}")

if __name__ == "__main__":
    run_ingestion(limit=500)