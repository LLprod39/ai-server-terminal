import { useCallback, useRef, useState } from "react";
import {
  AlertTriangle,
  Clock,
  Copy,
  Loader2,
  Play,
  Terminal,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { executeServerCommand, type FrontendServer } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

interface CommandResult {
  id: number;
  command: string;
  stdout: string;
  stderr: string;
  exitCode: number | null;
  timestamp: Date;
  duration: number;
  error?: string;
}

let cmdSeq = 0;

export function QuickRunWindow({
  server,
  active,
}: {
  server: FrontendServer;
  active: boolean;
}) {
  const { toast } = useToast();
  const [command, setCommand] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [history, setHistory] = useState<CommandResult[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const runCommand = useCallback(
    async (cmd: string) => {
      if (!cmd.trim() || isRunning) return;

      setIsRunning(true);
      const start = Date.now();
      const id = ++cmdSeq;

      try {
        const res = await executeServerCommand(server.id, cmd.trim());
        const duration = Date.now() - start;

        const result: CommandResult = {
          id,
          command: cmd.trim(),
          stdout: res.output?.stdout || "",
          stderr: res.output?.stderr || "",
          exitCode: res.output?.exit_code ?? null,
          timestamp: new Date(),
          duration,
          error: res.error || undefined,
        };

        setHistory((prev) => [...prev, result]);
        setCommand("");
        setHistoryIndex(-1);
      } catch (err) {
        setHistory((prev) => [
          ...prev,
          {
            id,
            command: cmd.trim(),
            stdout: "",
            stderr: "",
            exitCode: null,
            timestamp: new Date(),
            duration: Date.now() - start,
            error: err instanceof Error ? err.message : "Command execution failed",
          },
        ]);
      } finally {
        setIsRunning(false);
        setTimeout(() => {
          scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
        }, 50);
      }
    },
    [server.id, isRunning],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" && command.trim()) {
        e.preventDefault();
        void runCommand(command);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        const cmds = history.map((h) => h.command);
        if (cmds.length === 0) return;
        const next = historyIndex < 0 ? cmds.length - 1 : Math.max(0, historyIndex - 1);
        setHistoryIndex(next);
        setCommand(cmds[next]);
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        const cmds = history.map((h) => h.command);
        if (historyIndex < 0) return;
        const next = historyIndex + 1;
        if (next >= cmds.length) {
          setHistoryIndex(-1);
          setCommand("");
        } else {
          setHistoryIndex(next);
          setCommand(cmds[next]);
        }
      }
    },
    [command, history, historyIndex, runCommand],
  );

  const copyOutput = useCallback((text: string) => {
    void navigator.clipboard.writeText(text);
    toast({ title: "Copied", description: "Output copied to clipboard" });
  }, [toast]);

  const quickCommands = [
    { label: "uptime", cmd: "uptime" },
    { label: "whoami", cmd: "whoami" },
    { label: "df -h", cmd: "df -h" },
    { label: "free -m", cmd: "free -m" },
    { label: "ip addr", cmd: "ip addr show" },
    { label: "last -5", cmd: "last -5" },
    { label: "cat /etc/os-release", cmd: "cat /etc/os-release" },
    { label: "systemctl --failed", cmd: "systemctl --failed" },
  ];

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      {/* Quick command chips */}
      <div className="border-b border-border/60 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Terminal className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Quick:</span>
          <div className="flex flex-wrap gap-1">
            {quickCommands.map((qc) => (
              <button
                key={qc.cmd}
                type="button"
                onClick={() => void runCommand(qc.cmd)}
                disabled={isRunning}
                className="rounded-full border border-border/70 bg-background/90 px-2 py-0.5 font-mono text-[10px] text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors disabled:opacity-50"
              >
                {qc.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Output history */}
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto bg-card">
        {history.length === 0 ? (
          <div className="flex h-full items-center justify-center p-6">
            <div className="text-center">
              <Terminal className="mx-auto mb-3 h-8 w-8 text-muted-foreground/50" />
              <div className="text-sm text-muted-foreground">Run commands on {server.name}</div>
              <div className="mt-1 text-xs text-muted-foreground">
                Type a command below or use quick-run chips above
              </div>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-border/30">
            {history.map((result) => (
              <div key={result.id} className="px-4 py-3">
                {/* Command line */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="shrink-0 font-mono text-xs text-primary">$</span>
                    <span className="font-mono text-xs text-foreground break-all">{result.command}</span>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <span
                      className={cn(
                        "rounded-full border px-1.5 py-0.5 text-[9px] uppercase tracking-wide",
                        result.error
                          ? "border-destructive/30 bg-destructive/10 text-destructive"
                          : result.exitCode === 0
                            ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
                            : result.exitCode != null
                              ? "border-amber-500/20 bg-amber-500/10 text-amber-400"
                              : "border-border/60 bg-muted text-muted-foreground",
                      )}
                    >
                      {result.error ? "err" : result.exitCode != null ? `exit ${result.exitCode}` : "?"}
                    </span>
                    <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                      <Clock className="h-2.5 w-2.5" />
                      {result.duration}ms
                    </span>
                  </div>
                </div>

                {/* Output */}
                {result.error ? (
                  <div className="mt-2 flex items-start gap-2 rounded-lg border border-destructive/25 bg-destructive/5 p-2">
                    <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-destructive" />
                    <pre className="whitespace-pre-wrap break-words font-mono text-[11px] text-destructive">
                      {result.error}
                    </pre>
                  </div>
                ) : null}

                {result.stdout ? (
                  <div className="group relative mt-2 rounded-lg border border-border/40 bg-background/60 p-2">
                    <pre className="whitespace-pre-wrap break-words font-mono text-[11px] leading-5 text-foreground/90">
                      {result.stdout}
                    </pre>
                    <button
                      type="button"
                      onClick={() => copyOutput(result.stdout)}
                      className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded opacity-0 group-hover:opacity-100 hover:bg-muted transition-opacity"
                    >
                      <Copy className="h-3 w-3 text-muted-foreground" />
                    </button>
                  </div>
                ) : null}

                {result.stderr ? (
                  <div className="mt-1.5 rounded-lg border border-amber-500/20 bg-amber-500/5 p-2">
                    <pre className="whitespace-pre-wrap break-words font-mono text-[11px] leading-5 text-amber-300/90">
                      {result.stderr}
                    </pre>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Command input */}
      <div className="border-t border-border/60 bg-muted/30 px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="shrink-0 font-mono text-xs text-primary">
            {server.username}@{server.host}:$
          </span>
          <Input
            ref={inputRef}
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a command..."
            className="h-7 flex-1 border-0 bg-transparent p-0 font-mono text-xs text-foreground shadow-none outline-none ring-0 focus-visible:ring-0"
            disabled={isRunning}
            autoFocus
          />
          {isRunning ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
          ) : (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-6 w-6 p-0"
              disabled={!command.trim()}
              onClick={() => void runCommand(command)}
            >
              <Play className="h-3 w-3" />
            </Button>
          )}
          {history.length > 0 && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-6 w-6 p-0 text-muted-foreground"
              onClick={() => setHistory([])}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
