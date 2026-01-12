# LogChat Screenshot Checklist

To make your report look professional, you need high-quality screenshots.
Follow this list to capture the necessary evidence.

## 1. The Main Dashboard (`dashboard_full.png`)
*   **Action:** Log in to the app. Browse to `/dashboard`.
*   **Content:** Ensure the "Activity Graph" shows some data (run the seed script if needed). Ensure "Recent Logs" table has entries.
*   **Why:** Proves the UI exists and works.

## 2. The Chat Interface (`chat_rag_example.png`)
*   **Action:** Go to the Chat bubble.
*   **Input:** Type a question like *"Do we have any errors from Nginx?"*.
*   **Wait:** Wait for the AI to reply.
*   **Capture:** Screenshot the bubble with both your question and the AI's answer.
*   **Why:** Validates the "AI-Powered" claim.

## 3. The Agent Terminal (`terminal_agent_run.png`)
*   **Action:** Open a terminal where you are running the `logchat-agent`.
*   **Content:** It should show logs like:
    ```
    INFO[0000] Starting File Watcher...
    INFO[0005] Batch sent successfully (201 Created)
    ```
*   **Why:** proves the Go binary is actually running and talking to the server.

## 4. Docker Containers (`docker_ps.png`)
*   **Action:** Run `docker ps` in your terminal.
*   **Content:** Show the 4 containers: `frontend`, `backend`, `db`, `ollama` with Status "Up".
*   **Why:** Proves the containerization architecture.

## 5. Mobile View (Optional)
*   **Action:** Resize browser to phone size.
*   **Capture:** The responsive menu or stacked charts.

---
**Tip:** Save all these images into `report/images/` and update the `\placeholderImage` commands in LaTeX to point to them!
