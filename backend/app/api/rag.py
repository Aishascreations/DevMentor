from typing import List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from qdrant_client.http import models as qmodels

from app.database import get_db
from app.models import User, Document
from app.security import get_current_user
from app.services.rag_service import RAGService, qdrant

router = APIRouter(prefix="/api/documents", tags=["PDF Notes Assistant (RAG)"])


@router.post("/upload", status_code=status.HTTP_201_CREATED)
async def upload_pdf(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """FR-12 & FR-13: Ingest PDF, split into chunks, embed, and store in Qdrant."""[cite: 1]
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted.")

    # 10-document limit check (FR-12)
    stmt_count = select(func.count(Document.id)).where(Document.user_id == current_user.id)
    res_count = await db.execute(stmt_count)
    doc_count = res_count.scalar() or 0

    if doc_count >= 10:
        raise HTTPException(
            status_code=400,
            detail="You have reached the maximum limit of 10 documents. Please delete one first."
        )

    file_bytes = await file.read()
    if len(file_bytes) > 20 * 1024 * 1024:  # 20 MB limit
        raise HTTPException(status_code=400, detail="File size exceeds the 20 MB limit.")

    try:
        document = await RAGService.process_pdf_and_index(
            db=db,
            user_id=current_user.id,
            file_bytes=file_bytes,
            filename=file.filename
        )
        return {
            "id": document.id,
            "filename": document.filename,
            "page_count": document.page_count,
            "chunk_count": document.chunk_count,
            "uploaded_at": document.uploaded_at
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PDF processing failed: {str(e)}")


@router.post("/query")
async def query_notes(
    payload: dict,
    current_user: User = Depends(get_current_user)
):
    """FR-15 & FR-16: Grounded semantic query streaming using Qdrant vector retrieval."""[cite: 1]
    query = payload.get("query")
    if not query:
        raise HTTPException(status_code=400, detail="Query string is required.")

    return StreamingResponse(
        RAGService.query_notes_stream(current_user.id, query),
        media_type="text/event-stream"
    )


@router.get("", response_model=List[dict])
async def list_documents(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """FR-17: List uploaded documents for the user."""
    stmt = (
        select(Document)
        .where(Document.user_id == current_user.id)
        .order_by(Document.uploaded_at.desc())
    )
    res = await db.execute(stmt)
    docs = res.scalars().all()
    return [
        {
            "id": doc.id,
            "filename": doc.filename,
            "file_size_bytes": doc.file_size_bytes,
            "page_count": doc.page_count,
            "chunk_count": doc.chunk_count,
            "uploaded_at": doc.uploaded_at
        }
        for doc in docs
    ]


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(
    document_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """FR-17: Delete document record from DB and remove associated Qdrant vectors."""[cite: 1]
    stmt = select(Document).where(Document.id == document_id, Document.user_id == current_user.id)
    res = await db.execute(stmt)
    doc = res.scalar_one_or_none()

    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")

    # Remove vector points from Qdrant
    collection_name = doc.qdrant_collection
    try:
        qdrant.delete(
            collection_name=collection_name,
            points_selector=qmodels.FilterSelector(
                filter=qmodels.Filter(
                    must=[
                        qmodels.FieldCondition(
                            key="document_id",
                            match=qmodels.MatchValue(value=str(doc.id))
                        )
                    ]
                )
            )
        )
    except Exception:
        pass

    await db.delete(doc)
    await db.commit()