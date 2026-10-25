import fitz  # PyMuPDF
import json
import uuid
import os
from typing import List, AsyncGenerator
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from openai import AsyncOpenAI
from qdrant_client import QdrantClient
from qdrant_client.http import models as qmodels
from langchain.text_splitter import RecursiveCharacterTextSplitter

from app.config import settings
from app.models import Document

client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
qdrant = QdrantClient(host=settings.QDRANT_HOST, port=settings.QDRANT_PORT)


class RAGService:

    @classmethod
    async def generate_stream(cls, query: str) -> AsyncGenerator[str, None]:
        """FR-06: General LLM chat streaming method yielding raw token deltas."""
        try:
            response = await client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[
                    {
                        "role": "system",
                        "content": "You are DevMentor, a helpful Computer Science tutor and technical assistant.",
                    },
                    {"role": "user", "content": query},
                ],
                stream=True,
            )

            async for chunk in response:
                content = chunk.choices[0].delta.content or ""
                if content:
                    yield content

        except Exception as e:
            yield f"\n[OpenAI Stream Error: {str(e)}]"

    @staticmethod
    def _ensure_collection_exists(collection_name: str):
        """Ensures Qdrant vector collection exists for the user space."""
        collections = qdrant.get_collections().collections
        exists = any(c.name == collection_name for c in collections)
        if not exists:
            qdrant.create_collection(
                collection_name=collection_name,
                vectors_config=qmodels.VectorParams(
                    size=1536,  # text-embedding-ada-002 dimension
                    distance=qmodels.Distance.COSINE,
                ),
            )

    @staticmethod
    async def process_pdf_and_index(
        db: AsyncSession, user_id: UUID, file_bytes: bytes, filename: str
    ) -> Document:
        """FR-12, FR-13, FR-14: Ingest PDF, chunk text, embed, and store in Qdrant."""
        doc = fitz.open(stream=file_bytes, filetype="pdf")
        page_count = len(doc)

        raw_chunks = []
        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=2000,  # ~500 tokens
            chunk_overlap=200,  # ~50 tokens
        )

        for page_idx in range(page_count):
            page = doc.load_page(page_idx)
            text = page.get_text()
            if not text.strip():
                continue

            splits = text_splitter.split_text(text)
            for split in splits:
                raw_chunks.append(
                    {"text": split, "page_number": page_idx + 1}
                )

        doc.close()

        if not raw_chunks:
            raise ValueError("No extractable text found in PDF.")

        collection_name = f"user_{str(user_id).replace('-', '_')}"
        RAGService._ensure_collection_exists(collection_name)

        doc_id = uuid.uuid4()
        chunk_texts = [c["text"] for c in raw_chunks]

        response = await client.embeddings.create(
            model="text-embedding-ada-002", input=chunk_texts
        )
        embeddings = [data.embedding for data in response.data]

        points = []
        for idx, (chunk_data, embedding) in enumerate(
            zip(raw_chunks, embeddings)
        ):
            point_id = str(uuid.uuid4())
            points.append(
                qmodels.PointStruct(
                    id=point_id,
                    vector=embedding,
                    payload={
                        "document_id": str(doc_id),
                        "filename": filename,
                        "page_number": chunk_data["page_number"],
                        "chunk_index": idx,
                        "text": chunk_data["text"],
                    },
                )
            )

        qdrant.upsert(collection_name=collection_name, points=points)

        new_document = Document(
            id=doc_id,
            user_id=user_id,
            filename=filename,
            file_size_bytes=len(file_bytes),
            page_count=page_count,
            chunk_count=len(raw_chunks),
            qdrant_collection=collection_name,
        )
        db.add(new_document)
        await db.commit()
        await db.refresh(new_document)

        return new_document

    @staticmethod
    async def query_notes_stream(
        user_id: UUID, query: str
    ) -> AsyncGenerator[str, None]:
        """FR-15 & FR-16: Semantic lookup in Qdrant and grounded LLM generation."""
        collection_name = f"user_{str(user_id).replace('-', '_')}"

        RAGService._ensure_collection_exists(collection_name)

        embed_res = await client.embeddings.create(
            model="text-embedding-ada-002", input=[query]
        )
        query_vector = embed_res.data[0].embedding

        search_results = qdrant.search(
            collection_name=collection_name,
            query_vector=query_vector,
            limit=5,
            score_threshold=0.72,
        )

        if not search_results:
            yield "I could not find relevant information in your uploaded documents."
            return

        context_blocks = []
        for res in search_results:
            payload = res.payload
            context_blocks.append(
                f"[{payload['filename']}, Page {payload['page_number']}]\n{payload['text']}"
            )

        context_str = "\n\n---\n\n".join(context_blocks)

        system_prompt = (
            "You are an AI Notes Assistant. Answer the user question STRICTLY using the provided document context. "
            "Cite your sources using notation. If the context does not contain the answer, "
            "clearly state that the information is not present in the notes."
        )

        messages = [
            {"role": "system", "content": system_prompt},
            {
                "role": "user",
                "content": f"Context:\n{context_str}\n\nQuestion: {query}",
            },
        ]

        response = await client.chat.completions.create(
            model="gpt-3.5-turbo", messages=messages, stream=True
        )

        async for chunk in response:
            content = chunk.choices[0].delta.content or ""
            if content:
                yield content