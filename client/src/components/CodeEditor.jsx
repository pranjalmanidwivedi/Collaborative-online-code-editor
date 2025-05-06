import { useEffect, useRef } from "react";
import Editor from "@monaco-editor/react";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import { MonacoBinding } from "y-monaco";
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

export const CodeEditor = ({ roomId, language, editorRef }) => {
  const { theme } = useTheme();
  const ydocRef = useRef(null);
  const providerRef = useRef(null);

  const handleEditorDidMount = (editor, monaco) => {
    editorRef.current = editor;
    const model = editor.getModel();
  
    const ydoc = new Y.Doc();
    ydocRef.current = ydoc;
  
    const provider = new WebsocketProvider(
      import.meta.env.VITE_YJS_WEBSOCKET_URL,
      roomId,
      ydoc
    );
    providerRef.current = provider;
  
    const yText = ydoc.getText("monaco");
  
    // Only insert boilerplate on sync if content is empty
    
  
    new MonacoBinding(yText, model, new Set([editor]), provider.awareness);
  
    monaco.editor.setTheme(theme === 'dark' ? 'vs-dark' : 'light');
  };
  

  useEffect(() => {
    if (editorRef.current) {
      ydocRef.current = defaultCode[language];
      editorRef.current.setValue(defaultCode[language]);
    }
  }, [language]);
  

  return (
    <div className="h-full">
      <Editor
        height="100%"
        width="100%"
        language={language}
        theme={theme === 'dark' ? 'vs-dark' : 'light'}
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
