"use client";

import React, { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  Code2,
  Copy,
  LogOut,
  Play,
  Users,
  Code,
  SquareTerminal,
  Download,
  ListRestart,
  Loader2,
} from "lucide-react";
import { Client } from "@/components/Client";
import { CodeEditor } from "@/components/CodeEditor";
import { Console } from "@/components/Console";
import { initSocket } from "@/lib/socket";
import { useToast } from "@/hooks/use-toast";
import axios from "axios";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function EditorPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  const [language, setLanguage] = useState("java");
  const [members, setMembers] = useState([]);
  const [username, setUsername] = useState("");
  const [consoleOutput, setConsoleOutput] = useState("");
  const [fileName, setFileName] = useState("Main");
  const [isExecuting, setIsExecuting] = useState(false);

  const socketRef = useRef(null);
  const codeRef = useRef(null);
  const editorRef = useRef(null);
  const { roomId } = useParams();

  const handleFileNameChange = (event) => {
    setFileName(event.target.value);
  };

  useEffect(() => {
    const init = async () => {
      if (!location.state?.username) {
        navigate("/create-room", {
          state: {
            roomId,
            directAccess: true,
          },
        });
        return;
      }

      setUsername(location.state.username);
      socketRef.current = await initSocket();

      const handleError = (e) => {
        console.log("connect_error", e);
        toast({
          title: "Socket Connection Error",
          description: e.message,
          variant: "destructive",
        });
        navigate("/create-room");
      };

      socketRef.current.on("connect-error", handleError);
      socketRef.current.on("connect_failed", handleError);

      socketRef.current.emit("join", {
        roomId,
        username: location.state.username,
      });

      socketRef.current.on("joined", ({ clients, username }) => {
        if (username !== location.state.username) {
          toast({
            title: "New Member Joined",
            description: `${username} joined the room.`,
            variant: "default",
          });
        }
        setMembers(clients);
      });

      // ✅ When someone asks for code, send it
      socketRef.current.on("request-code-sync", ({ socketId }) => {
        socketRef.current.emit("sync-code", {
          code: codeRef.current,
          socketId,
        });
      });

      // ✅ When I join, someone will send me the latest code
      socketRef.current.on("sync-code", ({ code }) => {
        if (code !== null && editorRef.current) {
          codeRef.current = code;
          editorRef.current.setValue(code);
        }
      });

      socketRef.current.on("disconnected", ({ socketId, username }) => {
        toast({
          title: "Member Disconnected",
          description: `${username} disconnected from the room.`,
          variant: "default",
        });
        setMembers((prev) =>
          prev.filter((client) => client.socketId !== socketId)
        );
      });
    };

    init();

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current.off("joined");
        socketRef.current.off("disconnected");
        socketRef.current.off("sync-code");
        socketRef.current.off("request-code-sync");
      }
    };
  }, [location.state, roomId, navigate, toast]);

  useEffect(() => {
    if (socketRef.current) {
      socketRef.current.on("program-output", ({ output }) => {
        setConsoleOutput((prev) => prev + output);
      });

      return () => {
        socketRef.current.off("program-output");
      };
    }
  });

  const copyRoomId = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard
        .writeText(roomId)
        .then(() => {
          toast({
            title: "Room ID Copied",
            description: "The room ID has been copied to your clipboard.",
            variant: "default",
          });
        })
        .catch((err) => {
          console.error("Failed to copy: ", err);
          toast({
            title: "Copy Failed",
            description: "Your browser does not support copying.",
            variant: "destructive",
          });
        });
    } else {
      toast({
        title: "Copy Failed",
        description: "Clipboard API is not supported in this environment.",
        variant: "destructive",
      });
    }
  };

  const handleLeaveRoom = () => {
    navigate("/");
  };

  const handleRunCode = async () => {
    try {
      setIsExecuting(true);
      setConsoleOutput("");

      await new Promise((resolve) => setTimeout(resolve, 2000));

      await axios.post(`${import.meta.env.VITE_BACKEND_URL}/compile`, {
        code: editorRef.current.getValue(),
        language,
        socketId: socketRef.current.id,
      });
    } catch (error) {
      console.error("Error running code:", error);
      setConsoleOutput("Error running code: " + error.message);
    } finally {
      setIsExecuting(false);
    }
  };

  const handleConsoleInput = (input) => {
    socketRef.current.emit("program-input", input);
  };

  const handleFileDownload = () => {
    const code = editorRef.current.getValue();
    const blob = new Blob([code], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${fileName}.${language}`;
    a.click();
  };

  const resetCode = () => {
    editorRef.current.setValue("");
  };

  const goToCodeReviewer = () => {
    navigate("/code-reviewer", {
      state: {
        roomId,
      },
    });
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-white dark:bg-gray-900 text-gray-900 dark:text-white">
      <div className="flex items-center justify-between p-4 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center space-x-2">
          <Code2 className="text-blue-500" />
          <span className="font-bold text-lg">
            Remote Code Execution Platform
          </span>
        </div>
        <ThemeToggle />
      </div>

      <div className="flex-grow flex overflow-hidden">
        <div className="hidden md:flex w-[200px] flex-shrink-0 border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex-col">
          <div className="flex-grow overflow-auto p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold">Members</h2>
              <Users className="h-4 w-4 text-gray-500 dark:text-gray-400" />
            </div>
            <ul className="space-y-2">
              {members.map((member) => (
                <Client key={member.socketId} name={member.username} />
              ))}
            </ul>
          </div>
          <div className="p-4 space-y-2">
            <Button
              onClick={copyRoomId}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Copy className="mr-2 h-4 w-4" /> Copy Workspace ID
            </Button>
            <Button
              onClick={handleLeaveRoom}
              className="w-full bg-red-600 hover:bg-red-700 text-white"
            >
              <LogOut className="mr-2 h-4 w-4" /> Leave Workspace
            </Button>
          </div>
        </div>

        <div className="flex-grow flex flex-col overflow-hidden">
          <div className="p-2 border-b bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger className="w-[150px] bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-200 dark:border-gray-600">
                  <SelectValue placeholder="Select a language" />
                </SelectTrigger>
                <SelectContent className="bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-200 dark:border-gray-600">
                  <SelectItem value="java">Java</SelectItem>
                  <SelectItem value="cpp">C++</SelectItem>
                  <SelectItem value="python">Python</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex-grow flex flex-col md:flex-row overflow-hidden">
            <div className="flex-grow border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex flex-col overflow-hidden">
              <div className="flex p-2 justify-between flex-wrap">
                <div className="flex items-center space-x-2 mb-2 md:mb-0">
                  <Code className="mx-3 text-gray-600 dark:text-gray-300" />
                  <div className="relative w-[160px]">
                    <Input
                      type="text"
                      value={fileName}
                      onChange={handleFileNameChange}
                      className="pr-[80px] bg-transparent border-0 border-b-2 rounded-none border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white"
                      placeholder="File name"
                    />
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                      <span className="text-gray-500 dark:text-gray-400">
                        .{language}
                      </span>
                    </div>
                  </div>
                  <Button
                    onClick={handleFileDownload}
                    className="text-gray-900 dark:text-white border-2 bg-transparent border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
                <div className="space-x-2 flex flex-row items-center justify-center">
                  <ListRestart
                    className="h-6 w-6 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 cursor-pointer mr-3"
                    title="Reset Code"
                    onClick={resetCode}
                  />
                  <Button
                    onClick={goToCodeReviewer}
                    className="bg-blue-500 hover:bg-blue-600 text-white"
                  >
                    Code Reviewer
                  </Button>
                  <Button
                    onClick={handleRunCode}
                    className="bg-green-600 hover:bg-green-700 text-white"
                    disabled={isExecuting}
                  >
                    {isExecuting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Running...
                      </>
                    ) : (
                      <>
                        <Play className="mr-2 h-6 w-6" />
                        Run Code
                      </>
                    )}
                  </Button>
                </div>
              </div>
              <div className="flex-grow overflow-hidden">
                <CodeEditor
                  roomId={roomId}
                  language={language}
                  editorRef={editorRef}
                />
              </div>
            </div>

            <div className="md:w-1/3 bg-gray-50 dark:bg-gray-800 flex flex-col overflow-hidden">
              <div className="flex p-1 items-center text-gray-900 dark:text-white">
                <SquareTerminal className="m-3" />
                Terminal
              </div>
              <div className="flex-grow overflow-hidden">
                <Console
                  consoleOutput={consoleOutput}
                  onInput={handleConsoleInput}
                  isExecuting={isExecuting}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
