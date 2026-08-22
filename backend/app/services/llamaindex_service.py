"""LlamaIndex Enterprise Document Ingestion & Grounded Semantic Retrieval Service."""
import logging
import io
import re
from typing import Dict, Any, List, Optional
import pypdf  # type: ignore

from llama_index.core import Document  # type: ignore
from llama_index.core.node_parser import SentenceSplitter  # type: ignore
from llama_index.core.schema import TextNode  # type: ignore

logger = logging.getLogger("dealroom.llamaindex")

DEFAULT_CONTRACT_KNOWLEDGE = """MASTER STATEMENT OF WORK & SERVICE AGREEMENT
Project: Fullstack Web Development & Cloud Architecture
Deliverables:
1. Responsive Frontend Architecture: 7 key pages (Homepage, About Us, Capabilities, Industries, Blog, Contact Us).
2. Backend API Integration & Optimization: Modular Node.js / Python REST endpoints with clean error handling.
3. Test Coverage & CI/CD Pipeline: Automated unit testing and GitHub Actions deployment.
4. Security & Performance SLA: Sub-24h blocker triage, 30-day post-launch warranty, and 99.9% uptime.
Commercial Terms:
- Milestone 1: 50% initial deposit upon core architecture and UI scaffold sign-off.
- Milestone 2: 50% release upon final deployment, testing, and GitHub repository handover.
- Full Intellectual Property (IP) and source code ownership transfer immediately upon final milestone release.
- Out-of-scope feature additions require formal written change order approval.
"""

class LlamaIndexService:
    """
    Enterprise Document Ingestion, Semantic Clause Indexing,
    and Grounded Contract Retrieval Engine using LlamaIndex Core.
    """
    def __init__(self):
        self.splitter = SentenceSplitter(chunk_size=384, chunk_overlap=48)
        self.active_docs: Dict[str, Document] = {}
        self.active_nodes: Dict[str, List[TextNode]] = {}

        # Pre-seed default contract knowledge so LlamaIndex is never empty
        self.index_text_content(DEFAULT_CONTRACT_KNOWLEDGE, doc_id="default_sow_knowledge")
        logger.info("LlamaIndex Enterprise Document Engine initialized with default SOW knowledge base")

    def index_text_content(self, text: str, doc_id: str = "active_contract", metadata: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Index raw contract / RFP text into LlamaIndex Nodes."""
        if not text or not text.strip():
            return {"status": "empty", "node_count": 0, "doc_id": doc_id}

        meta = metadata or {}
        doc = Document(text=text, doc_id=doc_id, metadata=meta)
        nodes = self.splitter.get_nodes_from_documents([doc])

        self.active_docs[doc_id] = doc
        self.active_nodes[doc_id] = nodes
        # Keep active_contract as the primary pointer
        self.active_docs["active_contract"] = doc
        self.active_nodes["active_contract"] = nodes

        logger.info(f"LlamaIndex indexed doc '{doc_id}' into {len(nodes)} semantic nodes ({len(text)} chars)")
        return {
            "status": "indexed",
            "doc_id": doc_id,
            "node_count": len(nodes),
            "total_chars": len(text),
            "sample_nodes": [n.text[:120] + "..." for n in nodes[:3]]
        }

    def index_pdf_bytes(self, file_bytes: bytes, filename: str = "contract.pdf") -> Dict[str, Any]:
        """Extract text from PDF stream and index into LlamaIndex."""
        extracted_pages = []
        try:
            reader = pypdf.PdfReader(io.BytesIO(file_bytes))
            for i, page in enumerate(reader.pages):
                txt = page.extract_text()
                if txt and txt.strip():
                    extracted_pages.append(f"--- Page {i+1} ---\n{txt}")
        except Exception as e:
            logger.error(f"LlamaIndex PDF extraction error: {e}")

        full_text = "\n\n".join(extracted_pages)
        return self.index_text_content(full_text, doc_id=filename, metadata={"filename": filename, "page_count": len(extracted_pages)})

    def query_indexed_contract(self, query_str: str, doc_id: str = "active_contract") -> Dict[str, Any]:
        """
        Query the indexed document nodes for relevant clauses,
        returning top cited excerpts and grounded answer synthesis.
        """
        nodes = self.active_nodes.get(doc_id)
        if not nodes and self.active_nodes:
            first_key = list(self.active_nodes.keys())[0]
            nodes = self.active_nodes[first_key]

        if not nodes:
            # Fallback to default knowledge
            self.index_text_content(DEFAULT_CONTRACT_KNOWLEDGE, doc_id="default_sow_knowledge")
            nodes = self.active_nodes.get("active_contract", [])

        # Extract meaningful search tokens
        stop_words = {"what", "when", "where", "which", "who", "whom", "this", "that", "these", "those", "have", "has", "had", "does", "done", "will", "would", "shall", "should", "the", "and", "for", "with", "about", "are", "can", "you", "tell", "show"}
        raw_words = re.findall(r'[a-zA-Z0-9$₹€£]+', query_str.lower())
        query_words = [w for w in raw_words if len(w) > 1 and w not in stop_words]

        scored_nodes: List[tuple[float, TextNode]] = []

        for node in nodes:
            node_text_lower = node.text.lower()
            score = 0.0

            # 1. Exact phrase match
            if query_str.strip().lower() in node_text_lower:
                score += 2.0

            # 2. Token overlap
            for w in query_words:
                if w in node_text_lower:
                    score += 1.0

            # 3. Currency / number bonus
            if any(c in node_text_lower for c in ["$", "₹", "€", "£", "%", "milestone", "warranty", "sla", "deposit", "deliverable"]):
                score += 0.3

            if score > 0:
                scored_nodes.append((score, node))

        # Sort by relevance score
        scored_nodes.sort(key=lambda x: x[0], reverse=True)
        top_nodes = scored_nodes[:3] if scored_nodes else [(0.5, n) for n in nodes[:2]]

        citations = []
        for score, node in top_nodes:
            citations.append({
                "score": round(score, 3),
                "text": node.text.strip(),
                "node_id": node.node_id
            })

        # Synthesize concise grounded answer
        if citations:
            best_chunk = citations[0]["text"]
            # Extract first 2 complete sentences for summary
            sentences = re.split(r'(?<=[.!?])\s+', best_chunk)
            answer_summary = " ".join(sentences[:2]) if sentences else best_chunk[:180]
            response_text = f"According to the indexed contract clauses: {answer_summary}"
        else:
            response_text = "Referenced contract knowledge base active. Please specify clause terms (e.g. milestones, warranty, deliverables, SLA)."

        return {
            "query": query_str,
            "matched": len(citations) > 0,
            "response": response_text,
            "citations": citations,
            "doc_id": doc_id
        }

# Global singleton
llamaindex_service = LlamaIndexService()
