import React, { useEffect, useRef } from "react";
import { EditorState } from "@codemirror/state";
import { EditorView, basicSetup } from "@codemirror/basic-setup";
import { yCollab } from "../extensions/yCollab";
import { createYjsProvider } from "../yjs/yjs-setup";

export const CodeEditor = ({ roomId }) => {
  const editorContainerRef = useRef(null);
  const editorViewRef = useRef(null);

  useEffect(() => {
    const { provider, yText, awareness } = createYjsProvider(roomId);

    const view = new EditorView({
      state: EditorState.create({
        doc: "",
        extensions: [
          basicSetup,
          yCollab(yText, awareness)
        ]
      }),
      parent: editorContainerRef.current
    });

    editorViewRef.current = view;

    return () => {
      provider.disconnect();
      view.destroy();
    };
  }, [roomId]);

  return (
    <div
      ref={editorContainerRef}
      className="h-full w-full border bg-white dark:bg-gray-900 overflow-hidden rounded"
    />
  );
};
