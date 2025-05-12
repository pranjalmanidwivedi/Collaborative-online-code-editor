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

  const ydoc = new Y.Doc();
  ydocRef.current = ydoc;

  const provider = new WebsocketProvider(
    import.meta.env.VITE_YJS_WEBSOCKET_URL,
    roomId,
    ydoc
  );
  providerRef.current = provider;

  const yText = ydoc.getText("monaco");
  const yMeta = ydoc.getMap("meta");

  // Use a consistent Monaco model with a shared URI
  const uri = monaco.Uri.parse("file:///main." + language); // based on selected language
  let model = monaco.editor.getModel(uri);

  if (!model) {
    model = monaco.editor.createModel("", language, uri);
  }

  editor.setModel(model); // ensure all users use the same model

  // Insert boilerplate only once when synced and content is empty
  provider.on("sync", (isSynced) => {
    if (isSynced && yText.toString().trim().length === 0) {
      yText.insert(0, defaultCode[language] || "");
      yMeta.set("language", language);
    }
  });

  // Listen to language change and overwrite code when changed
  yMeta.observe(() => {
    const newLang = yMeta.get("language");
    if (newLang && defaultCode[newLang]) {
      // Switch model and update editor content
      const newUri = monaco.Uri.parse("file:///main." + newLang);
      let newModel = monaco.editor.getModel(newUri);
      if (!newModel) {
        newModel = monaco.editor.createModel("", newLang, newUri);
      }
      editor.setModel(newModel);
      yText.delete(0, yText.length);
      yText.insert(0, defaultCode[newLang]);
    }
  });

  // Bind Monaco editor with Yjs
  new MonacoBinding(yText, model, new Set([editor]), provider.awareness);

  // Set the editor theme
  monaco.editor.setTheme(theme === "dark" ? "vs-dark" : "light");
};

  

  useEffect(() => {
    if (editorRef.current) {
      ydocRef.current = defaultCode[language];
      editorRef.current.setValue(defaultCode[language]);
    }
  }, [language, editorRef]);
  

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
