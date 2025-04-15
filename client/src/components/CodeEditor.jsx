import { useEffect, useRef } from "react";
import Editor from "@monaco-editor/react";
import { useTheme } from "@/contexts/ThemeContext";

const defaultCode = {
  java: `public class Main {
    public static void main(String[] args) {
        System.out.println("Hello, World!");
    }
}`,
  python: `print("Hello, World!")`,
  cpp: `#include <iostream>

int main() {
    std::cout << "Hello, World!" << std::endl;
    return 0;
}`
};

// Debounce helper
const debounce = (fn, delay) => {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
};

export const CodeEditor = ({ socketRef, roomId, onCodeChange, language, editorRef }) => {
  const codeRef = useRef(null);
  const isTyping = useRef(false);
  const { theme } = useTheme();

  // ✅ Create debounced emit once using useRef
  const debouncedEmitChange = useRef(
    debounce((value) => {
      if (socketRef.current) {
        socketRef.current.emit("code-change", {
          roomId,
          code: value,
        });
      }
    }, 200)
  ).current;

  const handleEditorDidMount = (editor, monaco) => {
    editorRef.current = editor;

    monaco.editor.setTheme(theme === 'dark' ? 'vs-dark' : 'light');

    if (!codeRef.current) {
      codeRef.current = defaultCode[language];
      editor.setValue(defaultCode[language]);
    }
  };

  // ✅ Proper socket event binding
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;

    const handleCodeChange = ({ code }) => {
      if (code !== null && !isTyping.current && editorRef.current) {
        const editor = editorRef.current;
        const currentValue = editor.getValue();
        if (currentValue !== code) {
          const position = editor.getPosition();
          const range = editor.getModel().getFullModelRange();

          editor.executeEdits(null, [
            {
              range,
              text: code,
              forceMoveMarkers: true,
            },
          ]);

          editor.pushUndoStop();
          editor.setPosition(position);
        }

        codeRef.current = code;
      }
    };

    socket.on("code-change", handleCodeChange);

    return () => {
      socket.off("code-change", handleCodeChange);
    };
  }, [socketRef, roomId]);

  const handleEditorChange = (value) => {
    if (!value) return;

    isTyping.current = true;
    codeRef.current = value;
    onCodeChange(value);

    debouncedEmitChange(value); // ✅ Use debounced emit

    setTimeout(() => {
      isTyping.current = false;
    }, 100);
  };

  useEffect(() => {
    if (editorRef.current) {
      codeRef.current = defaultCode[language];
      editorRef.current.setValue(defaultCode[language]);
    }
  }, [language]);

  useEffect(() => {
    if (editorRef.current) {
      const monaco = window.monaco;
      if (monaco) {
        monaco.editor.setTheme(theme === 'dark' ? 'vs-dark' : 'light');
      }
    }
  }, [theme]);

  return (
    <div className="h-full">
      <Editor
        height="100%"
        width="100%"
        language={language}
        theme={theme === 'dark' ? 'vs-dark' : 'light'}
        value={codeRef.current || defaultCode[language]}
        onChange={handleEditorChange}
        onMount={handleEditorDidMount}
        options={{
          minimap: { enabled: false },
          fontSize: 14,
          wordWrap: "on",
          automaticLayout: true,
        }}
      />
    </div>
  );
};
