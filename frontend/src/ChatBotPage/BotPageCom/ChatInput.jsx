import { useState, useEffect, useContext, useRef } from "react";
import axios from "axios";
import { useUser } from "@clerk/clerk-react";
import { SelectedCollectionContext } from "../../context/SelectedContext";
import { ChatResContext } from "../../context/ChatResContext";
import ChatLoader from "./ChatLoader";
import EmptyPage from "./EmptyPage";

export default function Dashboard() {
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [userInput, setUserInput] = useState("");
  const [response, setResponse] = useState(null);
  const [msg, setMsg] = useState([]);
  const { selected } = useContext(SelectedCollectionContext);
  const { rerankedDocuments, setRerankedDocuments } = useContext(ChatResContext);
  const { user } = useUser();

  const chatContainerRef = useRef(null);

  const scrollToBottom = () => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [msg]);

  const handleQuery = async () => {
    if (!userInput.trim()) {
      setMessage("Please enter a query");
      return;
    }
    if (!selected) {
      alert("Please select a collection first.");
      return;
    }

    const currentUserInput = userInput;
    setUserInput("");
    setLoading(true);
    setMessage("Querying...");

    const userMessage = { text: currentUserInput, sender: "user" };
    setMsg((prev) => [...prev, userMessage]);

    const loadingMessageId = Date.now();
    setMsg((prev) => [
      ...prev,
      { id: loadingMessageId, loading: true, sender: "bot" },
    ]);

    try {
      const response = await axios.post(
        "http://127.0.0.1:5000/query",
        {
          user: user?.username || "princekumar04",
          collection: selected || "default_collection",
          query: currentUserInput,
        },
        { headers: { "Content-Type": "application/json" } }
      );
      setRerankedDocuments(response.data.reranked_documents[0].content);
      setResponse(response.data.llm_response);

      setMsg((prev) =>
        prev.map((item) =>
          item.id === loadingMessageId
            ? { text: response.data.llm_response, sender: "bot" }
            : item
        )
      );
      setMessage("Query completed successfully!");
    } catch (error) {
      setMsg((prev) =>
        prev.map((item) =>
          item.id === loadingMessageId
            ? {
                text: `Error: ${error.response?.data?.error || error.message}`,
                sender: "bot",
                isError: true,
              }
            : item
        )
      );
      setMessage(`Query failed: ${error.response?.data?.error || error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col w-full h-[87vh] bg-[#0a0a0a] rounded-2xl overflow-hidden shadow-2xl border border-[#1e2a38] backdrop-blur-sm">
      {/* Chat Header */}
      <div className="bg-gradient-to-r from-[#1e2a38] to-[#0f1a28] px-6 py-4 border-b border-[#2e3b4e] rounded-t-2xl">
        <h2 className="text-[#a1c4fd] font-semibold tracking-wide text-lg">
          {selected ? `Collection: ${selected}` : "Select a collection to begin"}
        </h2>
      </div>

      {/* Chat History */}
      <div
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin scrollbar-thumb-[#4e9fd1] scrollbar-track-transparent"
      >
        {msg.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <EmptyPage />
          </div>
        ) : (
          msg.map((m, index) => (
            <div
              key={index}
              className={`flex ${m.sender === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`p-4 rounded-xl max-w-[70%] transition-all duration-300 ${
                  m.sender === "user"
                    ? "bg-gradient-to-r from-[#ff6b6b] to-[#ff8c42] text-white shadow-lg shadow-[#ff6b6b]/30 rounded-tr-none"
                    : m.isError
                    ? "bg-[#3b1a1a] text-[#ff9999] shadow-lg shadow-[#ff9999]/20 rounded-tl-none"
                    : "bg-gradient-to-r from-[#1e2a38] to-[#2e3b4e] text-[#d1e8ff] shadow-lg shadow-[#4e9fd1]/20 rounded-tl-none"
                }`}
              >
                {m.loading ? (
                  <div className="flex items-center space-x-2">
                    <ChatLoader />
                  </div>
                ) : (
                  <div className="whitespace-pre-wrap text-sm">{m.text}</div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Query Input */}
      <div className="p-4 bg-[#0f1a28] border-t border-[#2e3b4e] rounded-b-2xl">
        <div className="flex items-center bg-[#1e2a38]/80 rounded-xl overflow-hidden border border-[#4e9fd1]/30 focus-within:border-[#4e9fd1] focus-within:ring-2 focus-within:ring-[#4e9fd1]/50 transition-all duration-300 backdrop-blur-md">
          <input
            type="text"
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            placeholder="Ask something about your document..."
            className="flex-1 p-3 bg-transparent text-[#d1e8ff] placeholder-[#6b8299] focus:outline-none text-sm"
            onKeyPress={(e) => e.key === "Enter" && !loading && handleQuery()}
          />
          <button
            onClick={handleQuery}
            disabled={loading}
            className={`px-5 py-3 bg-gradient-to-r from-[#4e9fd1] to-[#1d73b2] text-white transition-all duration-300 ${
              loading
                ? "opacity-60 cursor-not-allowed"
                : "hover:from-[#1d73b2] hover:to-[#4e9fd1] hover:shadow-lg hover:shadow-[#4e9fd1]/40"
            }`}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.707l-3-3a1 1 0 00-1.414 0l-3 3a1 1 0 001.414 1.414L9 9.414V13a1 1 0 102 0V9.414l1.293 1.293a1 1 0 001.414-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>

        {/* Collection Indicator */}
        <div className="mt-2 text-xs text-[#6b8299] flex justify-between">
          <span>
            {selected ? `Querying: ${selected}` : "Please select a collection"}
          </span>
          {message && (
            <span
              className={`${
                message.includes("failed") ? "text-[#ff9999]" : "text-[#4e9fd1]"
              }`}
            >
              {message}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}