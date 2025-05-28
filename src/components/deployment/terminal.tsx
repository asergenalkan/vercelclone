"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

interface TerminalProps {
  logs: string;
  status: string;
  className?: string;
}

export function Terminal({ logs, status, className }: TerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const shouldAutoScroll = useRef(true);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (terminalRef.current && shouldAutoScroll.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [logs]);

  // Check if user has scrolled up
  const handleScroll = () => {
    if (terminalRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = terminalRef.current;
      shouldAutoScroll.current = scrollTop + clientHeight >= scrollHeight - 10;
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case "PENDING":
        return "bg-yellow-500";
      case "BUILDING":
        return "bg-blue-500";
      case "READY":
        return "bg-green-500";
      case "FAILED":
        return "bg-red-500";
      default:
        return "bg-gray-500";
    }
  };

  const getStatusText = () => {
    switch (status) {
      case "PENDING":
        return "Bekliyor";
      case "BUILDING":
        return "Build Ediliyor";
      case "READY":
        return "Hazır";
      case "FAILED":
        return "Başarısız";
      default:
        return status;
    }
  };

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Terminal Header */}
      <div className="bg-gray-900 border border-gray-800 rounded-t-lg px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
          </div>
          <span className="text-sm text-gray-400 ml-2">Build Logs</span>
        </div>
        <div className="flex items-center gap-2">
          <div className={cn("w-2 h-2 rounded-full animate-pulse", getStatusColor())}></div>
          <span className="text-sm text-gray-400">{getStatusText()}</span>
        </div>
      </div>

      {/* Terminal Body */}
      <div
        ref={terminalRef}
        onScroll={handleScroll}
        className="bg-black border-x border-b border-gray-800 rounded-b-lg p-4 font-mono text-sm text-gray-300 overflow-y-auto flex-1"
        style={{ minHeight: "400px", maxHeight: "600px" }}
      >
        {logs ? (
          <pre className="whitespace-pre-wrap break-words">{logs}</pre>
        ) : (
          <div className="text-gray-500">Build logları bekleniyor...</div>
        )}
        
        {/* Cursor */}
        {status === "BUILDING" && (
          <span className="inline-block w-2 h-4 bg-gray-400 animate-pulse ml-1"></span>
        )}
      </div>
    </div>
  );
} 