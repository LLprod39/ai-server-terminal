import { useCallback, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Clock,
  Globe,
  Key,
  Loader2,
  RefreshCw,
  Server,
  Shield,
  User,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { executeServerCommand, type FrontendServer } from "@/lib/api";
import { cn } from "@/lib/utils";

type SettingsSection = "general" | "users" | "crontab" | "environment" | "security";

interface SectionDef {
  id: SettingsSection;
  label: string;
  icon: React.ReactNode;
}

const SECTIONS: SectionDef[] = [
  { id: "general", label: "General", icon: <Server className="h-4 w-4" /> },
  { id: "users", label: "Users", icon: <Users className="h-4 w-4" /> },
  { id: "crontab", label: "Cron Jobs", icon: <Clock className="h-4 w-4" /> },
  { id: "environment", label: "Environment", icon: <Globe className="h-4 w-4" /> },
  { id: "security", label: "Security", icon: <Shield className="h-4 w-4" /> },
];

function InfoCard({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-xl border border-border/70 bg-background/90 p-3">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={cn("mt-1.5 text-sm text-foreground break-words", mono && "font-mono text-xs")}>{value || "N/A"}</div>
    </div>
  );
}

function useServerCommand(serverId: number, command: string, enabled: boolean) {
  return useQuery({
    queryKey: ["settings-cmd", serverId, command],
    queryFn: async () => {
      const res = await executeServerCommand(serverId, command);
      return res.output?.stdout?.trim() || res.error || "";
    },
    enabled,
    staleTime: 30_000,
  });
}

function GeneralSection({ server, active }: { server: FrontendServer; active: boolean }) {
  const hostname = useServerCommand(server.id, "hostname -f 2>/dev/null || hostname", active);
  const timezone = useServerCommand(server.id, "timedatectl show --property=Timezone --value 2>/dev/null || cat /etc/timezone 2>/dev/null || echo unknown", active);
  const kernel = useServerCommand(server.id, "uname -r", active);
  const osRelease = useServerCommand(server.id, "cat /etc/os-release 2>/dev/null | head -5", active);
  const uptime = useServerCommand(server.id, "uptime -p 2>/dev/null || uptime", active);
  const arch = useServerCommand(server.id, "uname -m", active);
  const cpuInfo = useServerCommand(server.id, "nproc 2>/dev/null && cat /proc/cpuinfo 2>/dev/null | grep 'model name' | head -1 | cut -d: -f2", active);
  const memInfo = useServerCommand(server.id, "free -h | head -2 | tail -1 | awk '{print $2}'", active);

  const isLoading = hostname.isLoading || timezone.isLoading;

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
        <span className="ml-2 text-sm text-muted-foreground">Loading system info...</span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="text-sm font-medium text-foreground">System Information</div>
      <div className="grid gap-2 sm:grid-cols-2">
        <InfoCard label="Hostname" value={hostname.data || ""} mono />
        <InfoCard label="Timezone" value={timezone.data || ""} />
        <InfoCard label="Kernel" value={kernel.data || ""} mono />
        <InfoCard label="Architecture" value={arch.data || ""} />
        <InfoCard label="Uptime" value={uptime.data || ""} />
        <InfoCard label="CPU" value={cpuInfo.data || ""} />
        <InfoCard label="Total Memory" value={memInfo.data || ""} />
      </div>
      {osRelease.data && (
        <div className="rounded-xl border border-border/70 bg-background/90 p-3">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">OS Release</div>
          <pre className="mt-1.5 whitespace-pre-wrap font-mono text-xs text-foreground">{osRelease.data}</pre>
        </div>
      )}
    </div>
  );
}

function UsersSection({ server, active }: { server: FrontendServer; active: boolean }) {
  const whoami = useServerCommand(server.id, "whoami", active);
  const users = useServerCommand(server.id, "awk -F: '$3 >= 1000 && $3 < 65534 { print $1\":\"$3\":\"$6\":\"$7 }' /etc/passwd 2>/dev/null", active);
  const loggedIn = useServerCommand(server.id, "who 2>/dev/null || w -h 2>/dev/null", active);
  const lastLogins = useServerCommand(server.id, "last -10 2>/dev/null | head -12", active);
  const sudoers = useServerCommand(server.id, "getent group sudo 2>/dev/null || getent group wheel 2>/dev/null || echo 'N/A'", active);

  const userList = (users.data || "")
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const [name, uid, home, shell] = line.split(":");
      return { name, uid, home, shell };
    });

  return (
    <div className="space-y-3">
      <div className="text-sm font-medium text-foreground">User Management</div>
      <div className="grid gap-2 sm:grid-cols-2">
        <InfoCard label="Current User" value={whoami.data || ""} mono />
        <InfoCard label="Sudo Group" value={sudoers.data || ""} mono />
      </div>

      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mt-4">System Users (UID ≥ 1000)</div>
      <div className="space-y-1.5">
        {userList.length > 0 ? userList.map((u) => (
          <div key={u.name} className="flex items-center justify-between rounded-xl border border-border/70 bg-background/90 px-3 py-2">
            <div className="flex items-center gap-2">
              <User className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="font-mono text-xs text-foreground">{u.name}</span>
              <span className="text-[10px] text-muted-foreground">uid:{u.uid}</span>
            </div>
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
              <span className="font-mono">{u.home}</span>
              <span className="font-mono">{u.shell}</span>
            </div>
          </div>
        )) : (
          <div className="rounded-xl border border-dashed border-border/70 bg-background/90 px-3 py-4 text-center text-xs text-muted-foreground">
            No regular users found
          </div>
        )}
      </div>

      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mt-4">Logged In Now</div>
      <div className="rounded-xl border border-border/70 bg-background/90 p-3">
        <pre className="whitespace-pre-wrap font-mono text-[11px] text-foreground">
          {loggedIn.data || "No sessions"}
        </pre>
      </div>

      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mt-4">Last Logins</div>
      <div className="rounded-xl border border-border/70 bg-background/90 p-3">
        <pre className="whitespace-pre-wrap font-mono text-[11px] text-foreground">
          {lastLogins.data || "No data"}
        </pre>
      </div>
    </div>
  );
}

function CrontabSection({ server, active }: { server: FrontendServer; active: boolean }) {
  const userCron = useServerCommand(server.id, "crontab -l 2>/dev/null || echo 'No crontab for current user'", active);
  const systemCron = useServerCommand(server.id, "cat /etc/crontab 2>/dev/null || echo 'No /etc/crontab'", active);
  const cronDirs = useServerCommand(server.id, "ls -la /etc/cron.d/ 2>/dev/null | tail -20 || echo 'No /etc/cron.d/'", active);
  const timers = useServerCommand(server.id, "systemctl list-timers --no-pager 2>/dev/null | head -20 || echo 'systemctl unavailable'", active);

  return (
    <div className="space-y-3">
      <div className="text-sm font-medium text-foreground">Scheduled Tasks</div>

      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">User Crontab</div>
      <div className="rounded-xl border border-border/70 bg-background/90 p-3">
        <pre className="whitespace-pre-wrap font-mono text-[11px] leading-5 text-foreground">{userCron.data || "Loading..."}</pre>
      </div>

      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">System Crontab (/etc/crontab)</div>
      <div className="rounded-xl border border-border/70 bg-background/90 p-3">
        <pre className="whitespace-pre-wrap font-mono text-[11px] leading-5 text-foreground">{systemCron.data || "Loading..."}</pre>
      </div>

      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">/etc/cron.d/</div>
      <div className="rounded-xl border border-border/70 bg-background/90 p-3">
        <pre className="whitespace-pre-wrap font-mono text-[11px] leading-5 text-foreground">{cronDirs.data || "Loading..."}</pre>
      </div>

      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Systemd Timers</div>
      <div className="rounded-xl border border-border/70 bg-background/90 p-3">
        <pre className="whitespace-pre-wrap font-mono text-[11px] leading-5 text-foreground">{timers.data || "Loading..."}</pre>
      </div>
    </div>
  );
}

function EnvironmentSection({ server, active }: { server: FrontendServer; active: boolean }) {
  const envVars = useServerCommand(server.id, "env | sort | head -50", active);
  const path = useServerCommand(server.id, "echo $PATH | tr ':' '\\n'", active);
  const shell = useServerCommand(server.id, "echo $SHELL", active);
  const lang = useServerCommand(server.id, "locale 2>/dev/null | head -5", active);

  return (
    <div className="space-y-3">
      <div className="text-sm font-medium text-foreground">Environment</div>
      <div className="grid gap-2 sm:grid-cols-2">
        <InfoCard label="Shell" value={shell.data || ""} mono />
        <InfoCard label="Locale" value={lang.data || ""} mono />
      </div>

      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mt-4">PATH Directories</div>
      <div className="rounded-xl border border-border/70 bg-background/90 p-3">
        <pre className="whitespace-pre-wrap font-mono text-[11px] leading-5 text-foreground">{path.data || "Loading..."}</pre>
      </div>

      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mt-4">Environment Variables</div>
      <div className="rounded-xl border border-border/70 bg-background/90 p-3">
        <pre className="whitespace-pre-wrap font-mono text-[11px] leading-5 text-foreground">{envVars.data || "Loading..."}</pre>
      </div>
    </div>
  );
}

function SecuritySection({ server, active }: { server: FrontendServer; active: boolean }) {
  const sshConfig = useServerCommand(server.id, "grep -E '^(PermitRootLogin|PasswordAuthentication|PubkeyAuthentication|Port|AllowUsers|AllowGroups)' /etc/ssh/sshd_config 2>/dev/null || echo 'Cannot read sshd_config'", active);
  const firewall = useServerCommand(server.id, "ufw status 2>/dev/null || iptables -L -n --line-numbers 2>/dev/null | head -30 || firewall-cmd --list-all 2>/dev/null || echo 'No firewall tool detected'", active);
  const failedLogins = useServerCommand(server.id, "journalctl -u sshd --no-pager -n 20 --grep='Failed' 2>/dev/null || grep 'Failed' /var/log/auth.log 2>/dev/null | tail -10 || echo 'No failed login data'", active);
  const openPorts = useServerCommand(server.id, "ss -tlnp 2>/dev/null | head -25 || netstat -tlnp 2>/dev/null | head -25 || echo 'Cannot list ports'", active);

  return (
    <div className="space-y-3">
      <div className="text-sm font-medium text-foreground">Security Overview</div>

      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">SSH Configuration</div>
      <div className="rounded-xl border border-border/70 bg-background/90 p-3">
        <pre className="whitespace-pre-wrap font-mono text-[11px] leading-5 text-foreground">{sshConfig.data || "Loading..."}</pre>
      </div>

      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Firewall Status</div>
      <div className="rounded-xl border border-border/70 bg-background/90 p-3">
        <pre className="whitespace-pre-wrap font-mono text-[11px] leading-5 text-foreground">{firewall.data || "Loading..."}</pre>
      </div>

      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Listening Ports</div>
      <div className="rounded-xl border border-border/70 bg-background/90 p-3">
        <pre className="whitespace-pre-wrap font-mono text-[11px] leading-5 text-foreground">{openPorts.data || "Loading..."}</pre>
      </div>

      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Recent Failed Logins</div>
      <div className="rounded-xl border border-border/70 bg-background/90 p-3">
        <pre className="whitespace-pre-wrap font-mono text-[11px] leading-5 text-foreground">{failedLogins.data || "Loading..."}</pre>
      </div>
    </div>
  );
}

export function SystemSettingsWindow({
  server,
  active,
}: {
  server: FrontendServer;
  active: boolean;
}) {
  const [section, setSection] = useState<SettingsSection>("general");

  return (
    <div className="flex h-full min-h-0 overflow-hidden">
      {/* Sidebar */}
      <nav className="flex w-44 shrink-0 flex-col border-r border-border/60 bg-muted/20">
        <div className="border-b border-border/40 px-3 py-2.5">
          <div className="text-xs font-medium text-foreground">System Settings</div>
          <div className="text-[10px] text-muted-foreground">{server.name}</div>
        </div>
        <div className="flex-1 space-y-0.5 p-1.5">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setSection(s.id)}
              className={cn(
                "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs transition-colors",
                section === s.id
                  ? "bg-primary/10 text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
              )}
            >
              <span className="flex h-4 w-4 items-center justify-center [&>svg]:h-3.5 [&>svg]:w-3.5">{s.icon}</span>
              {s.label}
            </button>
          ))}
        </div>
      </nav>

      {/* Content */}
      <ScrollArea className="min-h-0 flex-1">
        <div className="p-4">
          {section === "general" && <GeneralSection server={server} active={active} />}
          {section === "users" && <UsersSection server={server} active={active} />}
          {section === "crontab" && <CrontabSection server={server} active={active} />}
          {section === "environment" && <EnvironmentSection server={server} active={active} />}
          {section === "security" && <SecuritySection server={server} active={active} />}
        </div>
      </ScrollArea>
    </div>
  );
}
