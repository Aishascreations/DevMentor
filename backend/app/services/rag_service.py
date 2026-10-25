import fitz
import json
import uuid
from typing import List, AsyncGenerator
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from openai import AsyncOpenAI
from qdrant_client import QdrantClient
from qdrant_client.http import models as qmodels
from langchain_text_splitters import RecursiveCharacterTextSplitter

from app.config import settings
from app.models import Document

client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)

# Handle both cloud URL (https://...) and local Docker host
qdrant_host = getattr(settings, "QDRANT_HOST", "localhost")
qdrant_api_key = getattr(settings, "QDRANT_API_KEY", None)

if qdrant_host.startswith("http://") or qdrant_host.startswith("https://"):
    qdrant = QdrantClient(url=qdrant_host, api_key=qdrant_api_key)
else:
    qdrant = QdrantClient(host=qdrant_host, port=getattr(settings, "QDRANT_PORT", 6333), api_key=qdrant_api_key)

class RAGService:
    @staticmethod
    def _ensure_collection_exists(collection_name: str):
        collections = qdrant.get_collections().collections
        exists = any(c.name == collection_name for c in collections)
        if not exists:
            qdrant.create_collection(
                collection_name=collection_name,
                vectors_config=qmodels.VectorParams(
                    size=1536,
                    distance=qmodels.Distance.COSINE
                )
            )

    @staticmethod
    async def process_pdf_and_index(
        db: AsyncSession, user_id: UUID, file_bytes: bytes, filename: str
    ) -> Document:
        doc = fitz.open(stream=file_bytes, filetype="pdf")
        page_count = len(doc)

        raw_chunks = []
        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=2000,
            chunk_overlap=200
        )

        for page_idx in range(page_count):
            page = doc.load_page(page_idx)
            text = page.get_text()
            if not text.strip():
                continue

            splits = text_splitter.split_text(text)
            for split in splits:
                raw_chunks.append({
                    "text": split,
                    "page_number": page_idx + 1
                })

        doc.close()

        if not raw_chunks:
            raise ValueError("No extractable text found in PDF.")

        collection_name = f"user_{str(user_id).replace('-', '_')}"
        RAGService._ensure_collection_exists(collection_name)

        doc_id = uuid.uuid4()
        chunk_texts = [c["text"] for c in raw_chunks]

        response = await client.embeddings.create(
            model="text-embedding-3-small",
            input=chunk_texts
        )
        embeddings = [data.embedding for data in response.data]

        points = []
        for idx, (chunk_data, embedding) in enumerate(zip(raw_chunks, embeddings)):
            point_id = str(uuid.uuid4())
            points.append(qmodels.PointStruct(
                id=point_id,
                vector=embedding,
                payload={
                    "document_id": str(doc_id),
                    "filename": filename,
                    "page_number": chunk_data["page_number"],
                    "chunk_index": idx,
                    "text": chunk_data["text"]
                }
            ))

        qdrant.upsert(collection_name=collection_name, points=points)

        new_doc = Document(
            id=doc_id,
            user_id=user_id,
            filename=filename,
            file_size_bytes=len(file_bytes),
            page_count=page_count,
            chunk_count=len(points),
            qdrant_collection=collection_name
        )
        db.add(new_doc)
        await db.commit()
        await db.refresh(new_doc)
        return new_doc

    @staticmethod
    async def generate_stream(prompt: str) -> AsyncGenerator[str, None]:
        response = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "You are DevMentor, an expert AI software engineering tutor."},
                {"role": "user", "content": prompt}
            ],
            stream=True
        )
        async for chunk in response:
            token = chunk.choices[0].delta.content or ""
            if token:
                yield token

    @staticmethod
    async def query_notes_stream(
        user_id: UUID, query_text: str
    ) -> AsyncGenerator[str, None]:
        collection_name = f"user_{str(user_id).replace('-', '_')}"
        RAGService._ensure_collection_exists(collection_name)

        embed_res = await client.embeddings.create(
            model="text-embedding-3-small",
            input=query_text
        )
        query_vector = embed_res.data[0].embedding

        search_res = qdrant.search(
            collection_name=collection_name,
            query_vector=query_vector,
            limit=5
        )

        context_blocks = []
        for hit in search_res:
            context_blocks.append(
                f"[Source: {hit.payload.get('filename')}, Page {hit.payload.get('page_number')}]: {hit.payload.get('text')}"
            )

        context_str = "\n\n".join(context_blocks) if context_blocks else "No relevant documents found."

        system_instruction = (
            "You are an AI assistant helping a developer answer questions using their uploaded PDF notes.\n"
            "Use the provided context below to answer accurately. Cite sources when appropriate.\n\n"
            f"--- CONTEXT FROM USER NOTES ---\n{context_str}"
        )

        response = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_instruction},
                {"role": "user", "content": query_text}
            ],
            stream=True
        )

        async for chunk in response:
            token = chunk.choices[0].delta.content or ""
            if token:
                yield token
