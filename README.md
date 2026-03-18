# 🧠 DistillAPI: Academic Research Summarizer

![DistillAPI Demo](https://via.placeholder.com/1200x600/4f46e5/ffffff?text=DistillAPI+Dashboard+Preview)

DistillAPI is a modern, full-stack AI application designed to transform dense academic research papers into highly structured, actionable insights. By leveraging **LangGraph** for orchestrating complex LLM workflows and **Next.js** for a sleek, dashboard-style interface, DistillAPI extracts core methodologies, key findings, and generates interactive study questions in seconds.

## ✨ Key Features

- **📄 Smart PDF Ingestion:** Asynchronously parses and chunks large PDF documents using LangChain.
- **🤖 State-Based AI Agent:** Uses LangGraph to orchestrate a multi-step summarization and Q&A pipeline.
- **🎯 Guaranteed Structured Outputs:** Enforces strict JSON schemas using Pydantic, ensuring the LLM always returns the exact format required by the UI.
- **🛡️ Defensive UI Rendering:** Built with Next.js and Shadcn, featuring a resilient frontend that handles missing data gracefully and renders markdown natively.
- **⚡ Async Backend:** FastAPI implementation with `asyncio` thread delegation prevents blocking, allowing high-concurrency document processing.

---

## 🏗️ Architecture Stack

### Backend (Python)

- **Framework:** [FastAPI](https://fastapi.tiangolo.com/)
- **AI Orchestration:** [LangGraph](https://python.langchain.com/v0.1/docs/langgraph/) & [LangChain](https://www.langchain.com/)
- **LLM Provider:** [OpenRouter](https://openrouter.ai/)  (`hunter-alpha`)
- **Data Validation:** Pydantic

### Frontend (TypeScript)

- **Framework:** [Next.js 15+](https://nextjs.org/) (App Router)
- **Styling:** Tailwind CSS
- **UI Components:** [Shadcn UI](https://ui.shadcn.com/) (Radix Primitives)
- **Markdown:** `react-markdown`
- **Icons:** Lucide React

---

## 🚀 Getting Started

Follow these instructions to get a copy of the project up and running on your local machine.

### Prerequisites

- Node.js (v18+)
- Python (3.9+)
- An [OpenRouter](https://openrouter.ai/) API Key.

### 1. Backend Setup (FastAPI & LangGraph)

Open a terminal and navigate to your backend directory:

```bash
# Create a virtual environment (recommended)
python -m venv venv
source venv/bin/activate  # On Windows use `venv\Scripts\activate`

# Install required Python packages
pip install fastapi uvicorn langchain langchain-openai langchain-community pypdf python-multipart pydantic python-dotenv
```


Create a `.env` file in the same directory as `main.py` and add your API key:

**Code snippet**

```
OPENAI_API_KEY="your-api-key-here"
```

Start the backend server:

**Bash**

```
python main.py
# Server will start on http://localhost:8000
```

## 2. Frontend Setup (Next.js)

Open a **new** terminal window and navigate to your frontend directory (`docuparse-web`):

**Bash**

```
# Install dependencies
npm install

# Install markdown renderer (if you haven't already)
npm install react-markdown
```

Start the development server:

**Bash**

```
npm run dev
# Frontend will start on http://localhost:3000
```

---

## 🧠 How the LangGraph Agent Works

The backend utilizes a directed graph (`StateGraph`) to process documents predictably:

1. **`load_pdf` node:** Reads the uploaded temporary PDF file and extracts raw text.
2. **`chunk_text` node:** Splits the text into manageable 4000-character chunks with overlap to preserve context.
3. **`summarize` node:** Ingests the chunks and uses `.with_structured_output(StructuredSummary)` to force the LLM to extract 7 specific academic data points (Core Problem, Methodology, etc.).
4. **`generate_qa` node:** Reads the structured summary state and generates 3 conceptual study questions and answers using strict Pydantic schemas.

---

## 🗺️ Roadmap / Future Enhancements

* [ ] **Map-Reduce Summarization:** Upgrade the `summarize_node` to process entire 50+ page PDFs by summarizing individual chunks and combining them, rather than just reading the first few pages.
* [ ] **Streaming Responses:** Implement Server-Sent Events (SSE) to stream the summary to the UI letter-by-letter as the LLM generates it.
* [ ] **Export to PDF/Markdown:** Add a button to download the generated insights.
* [ ] **Citation Tracking:** Map extracted methodologies back to specific page numbers in the original PDF.

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](https://www.google.com/search?q=LICENSE) file for details.

```

### Pro-Tips for your README:
* **The Hero Image:** Notice the `![DistillAPI Demo]` tag at the top. Once your app is running, take a screenshot of your beautiful dashboard, save it in a `public/` folder, and update that URL to point to your actual image! 
* **Customizing:** If you end up switching from OpenRouter back to standard OpenAI, just update the LLM Provider section.

This is a portfolio-grade README. If a recruiter or another developer looks at this, they will
```
