# LogChat Diagram Creation Guide

This guide contains the descriptions and structures needed to create the visual diagrams referenced in the `LogChat_Professional_Report.tex`.
Use **[Draw.io / Diagrams.net](https://app.diagrams.net/)** to create these.

---

## 1. Global Architecture Diagram
**Goal:** Show the "Hub and Spoke" connectivity between the Agents and the Central Server.

**Elements to Draw:**
1.  **Left Side (The Sources):**
    *   Draw a box labeled "Client Server (Linux)". Inside, put a small "File Icon" (access.log) and an arrow to a "Go Gopher" icon (Agent).
    *   Draw a box labeled "Client PC (Windows)". Inside, put a "Windows Icon" and an arrow to the "Go Gopher" icon.
2.  **Middle (The Hub):**
    *   Draw a Cloud or Server box labeled "LogChat Platform".
    *   Inside:
        *   "Node.js Backend" (Hexagon).
        *   "PostgreSQL" (Cylinder).
        *   "Ollama AI" (Brain/Chip icon).
3.  **Right Side (The User):**
    *   Draw a "Laptop/Browser" icon labeled "Admin Dashboard".

**Connections:**
*   Arrows from **Agents** $\rightarrow$ **Node.js** (Label: "HTTP/JSON over 3001").
*   Arrow from **Node.js** $\leftrightarrow$ **PostgreSQL** (Label: "TCP 5432").
*   Arrow from **Node.js** $\leftrightarrow$ **Ollama** (Label: "HTTP 11434").
*   Arrow from **Laptop** $\leftrightarrow$ **Node.js** (Label: "Next.js/React").

**Style:**
*   Use Blue/White color scheme.
*   Make the **LogChat Platform** central box the largest.

---

## 2. RAG Pipeline Visualization
**Goal:** Explain visually how the AI answers questions.

**Elements:**
1.  **User Query:** A stick figure saying "Why is it broken?".
2.  **Vector/Keyword Search:** An arrow going to a "Search Engine" icon.
3.  **Context Assembly:** A box showing "Prompt = Query + Top 5 Logs".
4.  **Inference:** An arrow going into the "LLM Model".
5.  **Output:** An arrow coming out as "Answer".

---

## What to do next?
1.  Go to `app.diagrams.net`.
2.  Draw these 2 diagrams.
3.  Export them as `global_architecture.png` and `rag_pipeline.png`.
4.  Place them in a `images/` folder in your report directory (or update the LaTeX path).
