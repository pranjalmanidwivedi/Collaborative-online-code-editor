import { useState, useEffect, useRef } from "react";
import "prismjs/themes/prism-tomorrow.css";
import Editor from "react-simple-code-editor";
import prism from "prismjs";
import Markdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/github-dark.css";
import axios from "axios";
import CodeReviewLoading from "../components/CodeReviewLoading"; // Import your loading component

function App() {
  const [code, setCode] = useState(``);
  const [review, setReview] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const editorRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    prism.highlightAll();
  }, []);

  useEffect(() => {
    // Auto-scroll editor container when new lines are added
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [code]);

  async function reviewCode() {
    setIsLoading(true);
    setReview("");

    try {
      const response = await axios.post("http://localhost:3005/ai/get-review", { code });
      setReview(response.data);
    } catch (error) {
      console.error("Error getting code review:", error);
      setReview("Error: Could not get review. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  return (

    
    <main className="h-screen w-screen p-6 flex gap-4">
      
      {/* Left Side - Code Editor */}
      <div className="left-side h-full w-1/2 bg-black rounded-lg relative flex flex-col">
        {/* Scrollable Editor Wrapper */}
        <div ref={containerRef} className="h-[90%] overflow-auto p-2 scrollbar-hidden">
          <Editor
            value={code}
            onValueChange={setCode}
            highlight={(code) => prism.highlight(code, prism.languages.javascript, "javascript")}
            padding={10}
            ref={editorRef}
            autoFocus
            style={{
              fontFamily: '"Fira Code", "Fira Mono", monospace',
              fontSize: 16,
              width: "100%",
              backgroundColor: "#000000",
              color: "#ffffff",
              borderRadius: "0.7rem",
              display: "block",
              whiteSpace: "pre-wrap", // Prevents horizontal scrolling
              wordWrap: "break-word",
              minHeight: "100%",
              overflow: "hidden",
            }}
          />
        </div>
        <div className="h-[10%]">
          {/* Review Button */}
        <button
          onClick={reviewCode}
          className={`absolute bottom-4 right-4 px-6 py-2 rounded-lg font-semibold 
            transition-opacity ${isLoading ? "opacity-50 cursor-not-allowed" : "bg-blue-500 text-black hover:bg-blue-600 cursor-pointer"}`}
          disabled={isLoading}
        >
          {isLoading ? "Reviewing..." : "Review"}
        </button>
        </div>
      </div>

      {/* Right Side - Review Output */}
      <div className="right-side h-full w-1/2 scrollbar-hidden bg-gray-800 p-4 text-white text-lg overflow-auto text-wrap rounded-lg">
        {isLoading ? <CodeReviewLoading /> : <Markdown rehypePlugins={[rehypeHighlight]}>{review}</Markdown>}
      </div>
    </main>
  );
}

export default App;
