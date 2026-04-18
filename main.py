import os
import shutil
import asyncio
import json
import re
import uuid
from typing import List, TypedDict, Dict, Any

from fastapi import FastAPI, UploadFile, File, HTTPException, BackgroundTasks
from pydantic import BaseModel
from dotenv import load_dotenv
from fastapi.middleware.cors import CORSMiddleware

from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_core.prompts import PromptTemplate
from langchain_community.vectorstores import FAISS
from langgraph.graph import StateGraph, END

load_dotenv()
api_key = os.getenv("OPENROUTER_API_KEY")
model_name = os.getenv("MODEL_NAME")

# ==========================================
# GLOBAL IN-MEMORY STORAGE
# ==========================================
vector_store_db = {}

# ==========================================
# MODELS (OPENROUTER)
# ==========================================

# Text Generation Model
llm = ChatOpenAI(
    model=model_name,
    api_key=api_key,
    base_url="https://openrouter.ai/api/v1",
    temperature=0.3
)

# Embedding Model (Routed through OpenRouter)
embeddings = OpenAIEmbeddings(
    openai_api_key=api_key,
    openai_api_base="https://openrouter.ai/api/v1",
    model="openai/text-embedding-3-small"
)

# ==========================================
# STATE
# ==========================================

class AgentState(TypedDict, total=False):
    doc_id: str
    file_path: str
    raw_text: str
    chunks: List[str]
    summary: Dict[str, Any]
    qa_pairs: List[Dict[str, Any]]

# ==========================================
# UTILS & PARSERS
# ==========================================

async def safe_invoke(chain, input_data, retries=2):
    last_exception = None
    for attempt in range(retries):
        try:
            return await chain.ainvoke(input_data)
        except Exception as e:
            print(f"⚠️ LLM Error on attempt {attempt + 1}: {str(e)}")
            last_exception = e
            await asyncio.sleep(2) 
            continue
    raise Exception(f"LLM failed after retries. Last error: {str(last_exception)}")

def fill_defaults(summary: dict):
    return {
        "tl_dr": summary.get("tl_dr") or "Summary unavailable.",
        "core_problem": summary.get("core_problem") or "Not clearly identified.",
        "methodology": summary.get("methodology") or ["Not specified"],
        "key_findings": summary.get("key_findings") or ["No findings extracted"],
        "strengths": summary.get("strengths") or ["Not specified"],
        "limitations": summary.get("limitations") or ["Not specified"],
        "practical_implications": summary.get("practical_implications") or "Not available"
    }

def parse_summary(text: str) -> Dict[str, Any]:
    text = re.sub(r'\*\*(.*?)\*\*', r'\1', text)
    sections = {
        "tl_dr": "", "core_problem": "", "methodology": [],
        "key_findings": [], "strengths": [], "limitations": [],
        "practical_implications": ""
    }
    headers = [
        ("TLDR:", "tl_dr", "str"), ("CORE PROBLEM:", "core_problem", "str"),
        ("METHODOLOGY:", "methodology", "list"), ("KEY FINDINGS:", "key_findings", "list"),
        ("STRENGTHS:", "strengths", "list"), ("LIMITATIONS:", "limitations", "list"),
        ("IMPLICATIONS:", "practical_implications", "str")
    ]
    current_key = None
    current_type = None

    for line in text.split("\n"):
        line = line.strip()
        if not line: continue
        found_header = False
        for header_text, key, expected_type in headers:
            if line.upper().startswith(header_text):
                current_key = key
                current_type = expected_type
                found_header = True
                content = line[len(header_text):].strip()
                if content:
                    if expected_type == "list":
                        content = re.sub(r'^[-*]\s*', '', content)
                        sections[current_key].append(content)
                    else:
                        sections[current_key] = content
                break
        if not found_header and current_key:
            if current_type == "list":
                content = re.sub(r'^[-*]\s*', '', line)
                if content: 
                    sections[current_key].append(content)
            else:
                sections[current_key] += " " + line if sections[current_key] else line
    return sections

def parse_qa(text: str) -> List[Dict[str, str]]:
    qa_pairs = []
    questions = re.findall(r'Q\d*[:.](.*?)(?=A\d*[:.]|$)', text, re.DOTALL)
    answers = re.findall(r'A\d*[:.](.*?)(?=Q\d*[:.]|$)', text, re.DOTALL)
    for i in range(min(len(questions), len(answers))):
        q = questions[i].strip()
        a = answers[i].strip()
        if q and a:
            qa_pairs.append({"question": q, "answer": a})
    return qa_pairs[:3]

# ==========================================
# NODES
# ==========================================

async def load_pdf_node(state: AgentState) -> AgentState:
    loader = PyPDFLoader(state["file_path"])
    docs = await asyncio.to_thread(loader.load)
    raw_text = "\n".join([doc.page_content for doc in docs])
    return {"raw_text": raw_text}

async def chunk_text_node(state: AgentState) -> AgentState:
    splitter = RecursiveCharacterTextSplitter(chunk_size=1500, chunk_overlap=400)
    chunks = await asyncio.to_thread(splitter.split_text, state["raw_text"])
    return {"chunks": chunks}

async def build_vector_store_node(state: AgentState) -> AgentState:
    chunks = state["chunks"]
    doc_id = state["doc_id"]
    
    vectorstore = await asyncio.to_thread(FAISS.from_texts, chunks, embeddings)
    vector_store_db[doc_id] = vectorstore
    
    return state

async def summarize_node(state: AgentState) -> AgentState:
    combined_text = "\n".join(state["chunks"][:6]) 
    prompt = PromptTemplate.from_template(
        "You are an expert research assistant.\n"
        "Summarize the paper by filling out the exact headings below. Do NOT change the headings.\n\n"
        "TLDR:\nCORE PROBLEM:\nMETHODOLOGY:\nKEY FINDINGS:\nSTRENGTHS:\nLIMITATIONS:\nIMPLICATIONS:\n\n"
        "Use bullet points for Methodology, Key Findings, Strengths, and Limitations.\n\n"
        "PAPER TEXT:\n{text}"
    )
    chain = prompt | llm
    response = await safe_invoke(chain, {"text": combined_text})
    parsed = parse_summary(response.content)
    return {"summary": fill_defaults(parsed)}

async def generate_qa_node(state: AgentState) -> AgentState:
    prompt = PromptTemplate.from_template(
        "You are an expert academic tutor. Your goal is to educate a reader who has NOT read the original paper.\n\n"
        "Generate exactly '5' insightful question-answer pairs that break down the paper's core concepts, methodology, and implications.\n\n"
        "CRITICAL INSTRUCTIONS:\n"
        "1. Act as a 'guided tour' and 'research scholar'. The questions should logically flow from medium understanding to deep technical nuances.\n"
        "2. Anticipate confusion. Ask 'Why did they use this specific method?' or 'How does this solve the core problem?'\n"
        "3. The answers MUST be highly descriptive, easy to understand, and provide enough context that a complete beginner grasps the paper's true value.\n"
        "4. Every question must challenge the novelty of the research. Don't just ask what the authors did; ask 'How does this approach specifically outperform previous industry standards or existing research mentioned in the paper?' The goal is to highlight the 'Gap' the authors are filling so the reader understands why this paper was worth writing in the first place.\n"
        "An expert scholar knows that no solution is perfect. At least one question MUST focus on the limitations, trade-offs, or specific conditions under which this methodology might fail. Ask 'What are the inherent costs (computational, financial, or accuracy-wise) of this new method, and in what scenarios would the traditional approach still be preferred?'\n\n"
        "You MUST format your response strictly like this:\n"
        "Q1: [Your first question]\n"
        "A1: [Your first answer]\n\n"
        "Q2: [Your second question]\n"
        "A2: [Your second answer]\n\n"
        "Q3: [Your third question]\n"
        "A3: [Your third answer]\n\n"
        "Q4: [Your fourth question]\n"
        "A4: [Your fourth answer]\n\n"
        "Q5: [Your fifth question]\n"
        "A5: [Your fifth answer]\n\n"
        "SUMMARY:\n{summary}"
    )
    chain = prompt | llm
    response = await safe_invoke(chain, {"summary": json.dumps(state["summary"], indent=2)})
    qa_pairs = parse_qa(response.content)
    return {"qa_pairs": qa_pairs}

# ==========================================
# GRAPH
# ==========================================

workflow = StateGraph(AgentState)

workflow.add_node("load_pdf", load_pdf_node)
workflow.add_node("chunk_text", chunk_text_node)
workflow.add_node("build_vector_store", build_vector_store_node)
workflow.add_node("summarize", summarize_node)
workflow.add_node("generate_qa", generate_qa_node)

workflow.set_entry_point("load_pdf")

workflow.add_edge("load_pdf", "chunk_text")
workflow.add_edge("chunk_text", "build_vector_store")
workflow.add_edge("build_vector_store", "summarize")
workflow.add_edge("summarize", "generate_qa")
workflow.add_edge("generate_qa", END)

app_graph = workflow.compile()

# ==========================================
# FASTAPI APP
# ==========================================

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

def cleanup_file(path: str):
    if os.path.exists(path):
        os.remove(path)

class ChatRequest(BaseModel):
    query: str

@app.post("/process-paper")
async def process_paper(background_tasks: BackgroundTasks, file: UploadFile = File(...)):
    if not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF supported")

    temp_path = f"temp_{file.filename}"
    doc_id = str(uuid.uuid4())

    with open(temp_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    background_tasks.add_task(cleanup_file, temp_path)

    try:
        final_state = await app_graph.ainvoke({"file_path": temp_path, "doc_id": doc_id})
        return {
            "status": "success",
            "doc_id": doc_id,
            "filename": file.filename,
            "data": {
                "summary": final_state.get("summary", {}),
                "qa_pairs": final_state.get("qa_pairs", [])
            }
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/chat/{doc_id}")
async def chat_with_paper(doc_id: str, request: ChatRequest):
    if doc_id not in vector_store_db:
        raise HTTPException(status_code=404, detail="Document not found or session expired. Please re-upload.")

    try:
        vectorstore = vector_store_db[doc_id]
        
        # 1. Retrieve the top chunks
        docs = vectorstore.similarity_search(request.query, k=5)
        
        # 2. Extract context for the LLM AND format sources for the Frontend
        context_parts = []
        frontend_sources = []
        
        for doc in docs:
            page_num = doc.metadata.get("page", 0) + 1 
            context_parts.append(f"--- [Page {page_num}] ---\n{doc.page_content}")
            
            # Save for the sidebar!
            frontend_sources.append({
                "page": page_num,
                "text": doc.page_content
            })
            
        context = "\n\n".join(context_parts)

        # 3. Ask the LLM
        rag_prompt = PromptTemplate.from_template(
            "You are an intelligent academic assistant. Answer the user's question based strictly on the provided context from the paper.\n"
            "If the answer cannot be found in the context, say 'I cannot answer this based on the provided document.'\n\n"
            "CONTEXT:\n{context}\n\n"
            "QUESTION: {question}\n\n"
            "ANSWER:"
        )

        chain = rag_prompt | llm
        response = await safe_invoke(chain, {
            "context": context,
            "question": request.query
        })

        # 4. Return BOTH the answer and the exact sources
        return {
            "status": "success",
            "answer": response.content,
            "sources": frontend_sources
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)