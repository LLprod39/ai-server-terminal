import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Bot,
  Activity,
  Users,
  Shield,
  FolderOpen,
  RefreshCw,
  Save,
  Search,
  ChevronRight,
  Cpu,
  Key,
  Globe,
  ScrollText,
  Eye,
  Terminal,
  MessageSquare,
  Workflow,
  Database,
  FileText,
  CalendarIcon,
  Settings2,
  Sparkles,
  CheckCircle2,
  XCircle,
  ArrowRight,
} from "lucide-react";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchModels,
  fetchSettings,
  fetchSettingsActivity,
  refreshModels,
  saveSettings,
  fetchAuthSession,
} from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

function relativeTime(value: string): string {
  const d = new Date(value);
  const diff = Math.max(1, Math.floor((Date.now() - d.getTime()) / 60000));
  if (diff < 60) return `${diff}m ago`;
  if (diff < 1440) return `${Math.floor(diff / 60)}h ago`;
  return `${Math.floor(diff / 1440)}d ago`;
}

const LLM_PROVIDERS = [
  { value: "grok", label: "Grok (xAI)" },
  { value: "gemini", label: "Gemini (Google)" },
  { value: "openai", label: "OpenAI" },
  { value: "claude", label: "Claude (Anthropic)" },
];

const AUTO_REASONING_VALUE = "__auto__";

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  terminal: Terminal,
  ai: Bot,
  agent: Bot,
  pipeline: Workflow,
  auth: Shield,
  server: Database,
  settings: Key,
};

const DATE_PRESETS = [
  { label: "Сегодня", days: 0 },
  { label: "Вчера", days: 1 },
  { label: "7 дней", days: 7 },
  { label: "14 дней", days: 14 },
  { label: "30 дней", days: 30 },
];

const DEFAULT_LOGGING_CONFIG = {
  log_terminal_commands: true,
  log_ai_assistant: true,
  log_agent_runs: true,
  log_pipeline_runs: true,
  log_auth_events: true,
  log_server_changes: true,
  log_settings_changes: true,
  log_file_operations: false,
  log_mcp_calls: true,
  log_http_requests: true,
  retention_days: 90,
  export_format: "json",
};
const LOGGING_KEYS = Object.keys(DEFAULT_LOGGING_CONFIG);

const LOGGING_ITEMS = [
  { key: "log_terminal_commands", label: "Команды терминала", desc: "SSH-команды пользователей", icon: Terminal },
  { key: "log_ai_assistant", label: "AI ассистент", desc: "Запросы и ответы AI", icon: MessageSquare },
  { key: "log_agent_runs", label: "Запуски агентов", desc: "Действия и итерации агентов", icon: Bot },
  { key: "log_pipeline_runs", label: "Pipeline запуски", desc: "Выполнение pipeline", icon: Workflow },
  { key: "log_auth_events", label: "Авторизация", desc: "Входы, выходы, попытки", icon: Shield },
  { key: "log_server_changes", label: "Изменения серверов", desc: "CRUD серверов", icon: Database },
  { key: "log_settings_changes", label: "Изменения настроек", desc: "Конфигурация платформы", icon: Key },
  { key: "log_mcp_calls", label: "MCP вызовы", desc: "Вызовы к MCP серверам", icon: Cpu },
  { key: "log_file_operations", label: "Файловые операции", desc: "Загрузки и скачивания", icon: FileText },
  { key: "log_http_requests", label: "HTTP/API запросы", desc: "Web/API запросы", icon: Globe },
];

type SettingsSection = "ai" | "models" | "keys" | "access" | "logging" | "activity";

interface NavItem {
  id: SettingsSection;
  label: string;
  icon: React.ElementType;
  adminOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { id: "ai", label: "Основная модель", icon: Bot },
  { id: "models", label: "Модели по назначению", icon: Cpu },
  { id: "keys", label: "API ключи", icon: Key, adminOnly: true },
  { id: "access", label: "Доступ", icon: Shield },
  { id: "logging", label: "Логирование", icon: ScrollText, adminOnly: true },
  { id: "activity", label: "Журнал", icon: Activity, adminOnly: true },
];

/* ═══════════════════════ MODEL SELECTOR CARD ═══════════════════════ */
function ModelCard({
  label, description, icon: Icon, provider, model, availableModels,
  onProviderChange, onModelChange, onRefresh, refreshing,
}: {
  label: string; description: string; icon: React.ElementType;
  provider: string; model: string; availableModels: string[];
  onProviderChange: (p: string) => void; onModelChange: (m: string) => void;
  onRefresh: () => void; refreshing: boolean;
}) {
  return (
    <div className="group rounded-xl border border-border/60 bg-card/50 p-5 hover:border-primary/20 hover:bg-card transition-all">
      <div className="flex items-center gap-3 mb-4">
        <div className="h-9 w-9 rounded-lg bg-primary/8 flex items-center justify-center">
          <Icon className="h-4.5 w-4.5 text-primary" />
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">{label}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-[11px] font-medium text-muted-foreground">Провайдер</label>
          <Select value={provider} onValueChange={onProviderChange}>
            <SelectTrigger className="h-9 text-xs bg-background/50"><SelectValue /></SelectTrigger>
            <SelectContent>
              {LLM_PROVIDERS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <label className="text-[11px] font-medium text-muted-foreground">Модель</label>
          {availableModels.length > 0 ? (
            <Select value={model} onValueChange={onModelChange}>
              <SelectTrigger className="h-9 text-xs bg-background/50"><SelectValue /></SelectTrigger>
              <SelectContent>
                {availableModels.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          ) : (
            <div className="flex gap-1.5">
              <Input value={model} onChange={(e) => onModelChange(e.target.value)} placeholder="Model name" className="h-9 text-xs bg-background/50" />
              <Button size="icon" variant="outline" className="h-9 w-9 shrink-0" onClick={onRefresh} disabled={refreshing}>
                <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
              </Button>
            </div>
          )}
        </div>
      </div>
      {availableModels.length > 0 && (
        <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2 gap-1 text-muted-foreground mt-2" onClick={onRefresh} disabled={refreshing}>
          <RefreshCw className={cn("h-2.5 w-2.5", refreshing && "animate-spin")} /> Обновить список
        </Button>
      )}
    </div>
  );
}

/* ═══════════════════════ MAIN COMPONENT ═══════════════════════ */
export default function SettingsPage() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [activeSection, setActiveSection] = useState<SettingsSection>("ai");

  const { data: authData } = useQuery({
    queryKey: ["auth", "session"],
    queryFn: fetchAuthSession,
    staleTime: 60_000,
    retry: false,
  });
  const isAdmin = authData?.user?.is_staff ?? false;

  const { data: settingsData, isLoading: settingsLoading, error: settingsError } = useQuery({
    queryKey: ["settings", "config"],
    queryFn: fetchSettings,
    staleTime: 30_000,
  });

  const { data: modelsData } = useQuery({
    queryKey: ["settings", "models"],
    queryFn: fetchModels,
    staleTime: 30_000,
  });

  // Activity
  const [activitySearch, setActivitySearch] = useState("");
  const [activityDays, setActivityDays] = useState(7);
  const [dateFrom, setDateFrom] = useState<Date | undefined>(subDays(new Date(), 7));
  const [dateTo, setDateTo] = useState<Date | undefined>(new Date());

  const computedDays = useMemo(() => {
    if (dateFrom && dateTo) return Math.max(1, Math.ceil((dateTo.getTime() - dateFrom.getTime()) / 86400000));
    return activityDays;
  }, [dateFrom, dateTo, activityDays]);

  const { data: activityData } = useQuery({
    queryKey: ["settings", "activity", computedDays],
    queryFn: () => fetchSettingsActivity(200, computedDays),
    enabled: isAdmin,
    staleTime: 20_000,
  });

  // AI state
  const [provider, setProvider] = useState("grok");
  const [model, setModel] = useState("");
  const [chatProvider, setChatProvider] = useState("grok");
  const [chatModel, setChatModel] = useState("");
  const [agentProvider, setAgentProvider] = useState("grok");
  const [agentModel, setAgentModel] = useState("");
  const [orchProvider, setOrchProvider] = useState("grok");
  const [orchModel, setOrchModel] = useState("");
  const [refreshingPurpose, setRefreshingPurpose] = useState<string | null>(null);
  const [reasoningEffort, setReasoningEffort] = useState(AUTO_REASONING_VALUE);
  const [refreshing, setRefreshing] = useState(false);

  // Logging
  const [loggingConfig, setLoggingConfig] = useState({ ...DEFAULT_LOGGING_CONFIG });
  const [loggingSaved, setLoggingSaved] = useState(false);

  useEffect(() => {
    const config = settingsData?.config;
    if (!config) return;
    const llmProviders = ["gemini", "grok", "openai", "claude"];
    const activeProvider = llmProviders.includes(config.internal_llm_provider || "")
      ? config.internal_llm_provider
      : llmProviders.includes(config.default_provider || "")
        ? config.default_provider
        : "grok";
    setProvider(activeProvider);
    if (activeProvider === "gemini") setModel(config.chat_model_gemini || "");
    else if (activeProvider === "openai") setModel(config.chat_model_openai || "");
    else if (activeProvider === "claude") setModel(config.chat_model_claude || "");
    else setModel(config.chat_model_grok || "");

    setChatProvider(config.chat_llm_provider || activeProvider);
    setChatModel(config.chat_llm_model || "");
    setAgentProvider(config.agent_llm_provider || activeProvider);
    setAgentModel(config.agent_llm_model || "");
    setOrchProvider(config.orchestrator_llm_provider || activeProvider);
    setOrchModel(config.orchestrator_llm_model || "");
    setReasoningEffort(config.openai_reasoning_effort || AUTO_REASONING_VALUE);
    setLoggingConfig({
      ...DEFAULT_LOGGING_CONFIG,
      ...Object.fromEntries(LOGGING_KEYS.map((key) => [key, config[key] ?? DEFAULT_LOGGING_CONFIG[key]])),
    });
  }, [settingsData]);

  const getModelsForProvider = useCallback((p: string): string[] => {
    if (!modelsData) return [];
    if (p === "gemini") return modelsData.gemini || [];
    if (p === "openai") return modelsData.openai || [];
    if (p === "claude") return modelsData.claude || [];
    return modelsData.grok || [];
  }, [modelsData]);

  const availableModels = useMemo(() => getModelsForProvider(provider), [getModelsForProvider, provider]);

  const onRefreshPurpose = async (p: string) => {
    setRefreshingPurpose(p);
    try {
      await refreshModels(p as "gemini" | "grok" | "openai" | "claude");
      await queryClient.invalidateQueries({ queryKey: ["settings", "models"] });
    } finally { setRefreshingPurpose(null); }
  };

  const onSavePurpose = async () => {
    setSaving(true);
    try {
      await saveSettings({
        chat_llm_provider: chatProvider, chat_llm_model: chatModel,
        agent_llm_provider: agentProvider, agent_llm_model: agentModel,
        orchestrator_llm_provider: orchProvider, orchestrator_llm_model: orchModel,
        internal_llm_provider: chatProvider,
        openai_reasoning_effort: reasoningEffort === AUTO_REASONING_VALUE ? "" : reasoningEffort,
      });
      await queryClient.invalidateQueries({ queryKey: ["settings", "config"] });
    } finally { setSaving(false); }
  };

  const onSave = async () => {
    setSaving(true);
    try {
      const llmProviders = ["gemini", "grok", "openai", "claude"];
      const isLlmProvider = llmProviders.includes(provider);
      const payload: Record<string, unknown> = { default_provider: provider };
      if (provider === "gemini") payload.chat_model_gemini = model;
      if (provider === "grok") payload.chat_model_grok = model;
      if (provider === "openai") payload.chat_model_openai = model;
      if (provider === "claude") payload.chat_model_claude = model;
      if (isLlmProvider) {
        payload.internal_llm_provider = provider;
        payload.gemini_enabled = provider === "gemini";
        payload.grok_enabled = provider === "grok";
        payload.openai_enabled = provider === "openai";
        payload.claude_enabled = provider === "claude";
      }
      await saveSettings(payload);
      await queryClient.invalidateQueries({ queryKey: ["settings", "config"] });
    } finally { setSaving(false); }
  };

  const onRefreshModels = async () => {
    setRefreshing(true);
    try {
      await refreshModels(provider as "gemini" | "grok" | "openai" | "claude");
      await queryClient.invalidateQueries({ queryKey: ["settings", "models"] });
    } finally { setRefreshing(false); }
  };

  const updateLogging = (key: string, val: unknown) => {
    setLoggingConfig((prev) => ({ ...prev, [key]: val }));
    setLoggingSaved(false);
  };

  const handleSaveLogging = async () => {
    setSaving(true);
    try {
      await saveSettings(Object.fromEntries(LOGGING_KEYS.map((key) => [key, loggingConfig[key]])));
      await queryClient.invalidateQueries({ queryKey: ["settings", "config"] });
      setLoggingSaved(true);
      setTimeout(() => setLoggingSaved(false), 2000);
    } finally { setSaving(false); }
  };

  const filteredActivity = useMemo(() => {
    const events = activityData?.events || [];
    let filtered = events;
    if (activitySearch) {
      const q = activitySearch.toLowerCase();
      filtered = events.filter(
        (e) =>
          e.username?.toLowerCase().includes(q) ||
          e.action?.toLowerCase().includes(q) ||
          (e.description || "").toLowerCase().includes(q) ||
          e.category?.toLowerCase().includes(q),
      );
    }
    if (dateFrom) {
      const from = startOfDay(dateFrom).getTime();
      filtered = filtered.filter((e) => new Date(e.timestamp || e.created_at || "").getTime() >= from);
    }
    if (dateTo) {
      const to = endOfDay(dateTo).getTime();
      filtered = filtered.filter((e) => new Date(e.timestamp || e.created_at || "").getTime() <= to);
    }
    return filtered;
  }, [activityData, activitySearch, dateFrom, dateTo]);

  if (settingsLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex items-center gap-3 text-muted-foreground">
          <RefreshCw className="h-4 w-4 animate-spin" />
          <span className="text-sm">{t("loading")}</span>
        </div>
      </div>
    );
  }
  if (settingsError || !settingsData?.success) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-sm text-destructive">{t("set.error")}</div>
      </div>
    );
  }

  const config = settingsData.config;
  const apiKeys = settingsData.api_keys as Record<string, boolean> | undefined;

  const visibleNav = NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin);

  return (
    <div className="flex h-full">
      {/* ═══════ LEFT NAV ═══════ */}
      <aside className="w-56 shrink-0 border-r border-border/50 bg-card/30 p-4 flex flex-col gap-1">
        <div className="flex items-center gap-2.5 px-3 py-3 mb-3">
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Settings2 className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-foreground leading-none">{t("settings.title")}</h1>
            <p className="text-[10px] text-muted-foreground mt-0.5">Управление платформой</p>
          </div>
        </div>

        {visibleNav.map((item) => {
          const isActive = activeSection === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveSection(item.id)}
              className={cn(
                "flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-all text-sm",
                isActive
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </aside>

      {/* ═══════ RIGHT CONTENT ═══════ */}
      <main className="flex-1 overflow-auto p-6">
        <div className="max-w-4xl mx-auto space-y-6">

          {/* ──── AI: Default Model ──── */}
          {activeSection === "ai" && (
            <>
              <SectionHeader
                title="Основная модель"
                description="Провайдер и модель по умолчанию для всех задач на платформе"
                icon={Bot}
              />

              <div className="rounded-xl border border-border/60 bg-card/50 p-6 space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">Провайдер</label>
                    <Select value={provider} onValueChange={setProvider}>
                      <SelectTrigger className="h-10 bg-background/50"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {LLM_PROVIDERS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">Модель</label>
                    {availableModels.length > 0 ? (
                      <Select value={model} onValueChange={setModel}>
                        <SelectTrigger className="h-10 bg-background/50"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {availableModels.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    ) : (
                      <div className="flex gap-2">
                        <Input value={model} onChange={(e) => setModel(e.target.value)} placeholder="Model name" className="h-10 bg-background/50" />
                        <Button size="icon" variant="outline" className="h-10 w-10 shrink-0" onClick={onRefreshModels} disabled={refreshing}>
                          <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-1">
                  <Button className="gap-2" onClick={onSave} disabled={saving}>
                    <Save className="h-4 w-4" /> {saving ? "Сохранение..." : "Сохранить"}
                  </Button>
                  {availableModels.length > 0 && (
                    <Button variant="outline" className="gap-2" onClick={onRefreshModels} disabled={refreshing}>
                      <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} /> Обновить модели
                    </Button>
                  )}
                </div>
              </div>

              {/* Domain auth (if available) */}
              {isAdmin && config.domain_auth_enabled !== undefined && (
                <div className="rounded-xl border border-border/60 bg-card/50 p-6">
                  <div className="flex items-center gap-2.5 mb-4">
                    <Globe className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium">Доменная авторизация</span>
                    <Badge variant={config.domain_auth_enabled ? "default" : "secondary"} className="text-[10px] ml-auto">
                      {config.domain_auth_enabled ? "Включен" : "Выключен"}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <InfoPill label="Статус" value={config.domain_auth_enabled ? "Активен" : "Выкл"} />
                    <InfoPill label="Header" value={config.domain_auth_header || "REMOTE_USER"} mono />
                    <InfoPill label="Авто-создание" value={config.domain_auth_auto_create ? "Да" : "Нет"} />
                  </div>
                </div>
              )}
            </>
          )}

          {/* ──── MODELS BY PURPOSE ──── */}
          {activeSection === "models" && (
            <>
              <SectionHeader
                title="Модели по назначению"
                description="Настройте отдельные модели для каждого типа задач"
                icon={Cpu}
              />

              <div className="space-y-4">
                <ModelCard
                  label="Чат / Терминальный AI" description="AI помощник в терминале" icon={MessageSquare}
                  provider={chatProvider} model={chatModel} availableModels={getModelsForProvider(chatProvider)}
                  onProviderChange={(p) => { setChatProvider(p); setChatModel(""); }}
                  onModelChange={setChatModel} onRefresh={() => onRefreshPurpose(chatProvider)}
                  refreshing={refreshingPurpose === chatProvider}
                />
                <ModelCard
                  label="Агенты (ReAct)" description="Выполнение задач с инструментами" icon={Bot}
                  provider={agentProvider} model={agentModel} availableModels={getModelsForProvider(agentProvider)}
                  onProviderChange={(p) => { setAgentProvider(p); setAgentModel(""); }}
                  onModelChange={setAgentModel} onRefresh={() => onRefreshPurpose(agentProvider)}
                  refreshing={refreshingPurpose === agentProvider}
                />
                <ModelCard
                  label="Оркестратор (Pipeline)" description="Планирование в мультиагентных пайплайнах" icon={Workflow}
                  provider={orchProvider} model={orchModel} availableModels={getModelsForProvider(orchProvider)}
                  onProviderChange={(p) => { setOrchProvider(p); setOrchModel(""); }}
                  onModelChange={setOrchModel} onRefresh={() => onRefreshPurpose(orchProvider)}
                  refreshing={refreshingPurpose === orchProvider}
                />

                {/* Reasoning effort */}
                <div className="rounded-xl border border-border/60 bg-card/50 p-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-lg bg-primary/8 flex items-center justify-center">
                        <Sparkles className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">OpenAI Reasoning Effort</p>
                        <p className="text-xs text-muted-foreground">Глубина reasoning в Responses API</p>
                      </div>
                    </div>
                    <Select value={reasoningEffort} onValueChange={setReasoningEffort}>
                      <SelectTrigger className="h-9 w-40 text-xs bg-background/50"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={AUTO_REASONING_VALUE}>Auto</SelectItem>
                        <SelectItem value="none">None ⚡⚡</SelectItem>
                        <SelectItem value="low">Low ⚡</SelectItem>
                        <SelectItem value="medium">Medium ⚖️</SelectItem>
                        <SelectItem value="high">High 🔬</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Button className="gap-2" onClick={onSavePurpose} disabled={saving}>
                  <Save className="h-4 w-4" /> {saving ? "Сохранение..." : "Сохранить модели"}
                </Button>
              </div>
            </>
          )}

          {/* ──── API KEYS ──── */}
          {activeSection === "keys" && isAdmin && (
            <>
              <SectionHeader
                title="API ключи"
                description="Статус подключения LLM провайдеров"
                icon={Key}
              />

              {apiKeys ? (
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { name: "Gemini", key: "gemini_set", enabled: config.gemini_enabled },
                    { name: "Grok", key: "grok_set", enabled: config.grok_enabled },
                    { name: "OpenAI", key: "openai_set", enabled: config.openai_enabled },
                    { name: "Claude", key: "claude_set", enabled: config.claude_enabled },
                  ].map((p) => (
                    <div
                      key={p.name}
                      className={cn(
                        "rounded-xl border p-5 flex items-center gap-4 transition-all",
                        apiKeys[p.key]
                          ? "border-green-500/20 bg-green-500/5"
                          : "border-border/60 bg-card/50"
                      )}
                    >
                      <div className={cn(
                        "h-10 w-10 rounded-lg flex items-center justify-center",
                        apiKeys[p.key] ? "bg-green-500/10" : "bg-muted/50"
                      )}>
                        {apiKeys[p.key]
                          ? <CheckCircle2 className="h-5 w-5 text-green-500" />
                          : <XCircle className="h-5 w-5 text-muted-foreground" />}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{p.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {apiKeys[p.key] ? "Ключ настроен" : "Не настроен"}
                          {p.enabled && " · Активен"}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">Нет данных о ключах</div>
              )}
            </>
          )}

          {/* ──── ACCESS ──── */}
          {activeSection === "access" && (
            <>
              <SectionHeader
                title="Управление доступом"
                description="Пользователи, группы и разрешения"
                icon={Shield}
              />

              <div className="grid grid-cols-1 gap-3">
                {[
                  { title: "Пользователи", desc: "Управление аккаунтами и ролями", icon: Users, url: "/settings/users" },
                  { title: "Группы", desc: "Группы серверов и доступ", icon: FolderOpen, url: "/settings/groups" },
                  { title: "Разрешения", desc: "Политики доступа к модулям", icon: Shield, url: "/settings/permissions" },
                ].map((page) => (
                  <Link
                    key={page.url}
                    to={page.url}
                    className="flex items-center gap-4 rounded-xl border border-border/60 bg-card/50 p-5 hover:border-primary/30 hover:bg-card transition-all group"
                  >
                    <div className="h-11 w-11 rounded-lg bg-primary/8 flex items-center justify-center shrink-0">
                      <page.icon className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium group-hover:text-primary transition-colors">{page.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{page.desc}</p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                  </Link>
                ))}
              </div>
            </>
          )}

          {/* ──── LOGGING ──── */}
          {activeSection === "logging" && isAdmin && (
            <>
              <SectionHeader
                title="Настройки логирования"
                description="Выберите какие действия пользователей записывать"
                icon={ScrollText}
                actions={
                  <Button className="gap-2" onClick={handleSaveLogging} disabled={saving}>
                    <Save className="h-4 w-4" />
                    {saving ? "Сохранение..." : loggingSaved ? "✓ Сохранено" : "Сохранить"}
                  </Button>
                }
              />

              {/* Toggle grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {LOGGING_ITEMS.map((item) => {
                  const Icon = item.icon;
                  const enabled = loggingConfig[item.key];
                  return (
                    <label
                      key={item.key}
                      className={cn(
                        "flex items-center gap-3 rounded-xl border p-4 cursor-pointer transition-all",
                        enabled
                          ? "border-primary/20 bg-primary/5"
                          : "border-border/60 bg-card/50 hover:bg-muted/30"
                      )}
                    >
                      <div className={cn(
                        "h-9 w-9 rounded-lg flex items-center justify-center shrink-0 transition-colors",
                        enabled ? "bg-primary/10" : "bg-muted/50"
                      )}>
                        <Icon className={cn("h-4 w-4", enabled ? "text-primary" : "text-muted-foreground")} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{item.label}</p>
                        <p className="text-[11px] text-muted-foreground">{item.desc}</p>
                      </div>
                      <Switch checked={enabled} onCheckedChange={(v) => updateLogging(item.key, v)} />
                    </label>
                  );
                })}
              </div>

              {/* Retention & export */}
              <div className="rounded-xl border border-border/60 bg-card/50 p-6">
                <h3 className="text-sm font-medium mb-4 flex items-center gap-2">
                  <Database className="h-4 w-4 text-primary" /> Хранение и экспорт
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs">Хранить логи (дней)</Label>
                    <Select
                      value={String(loggingConfig.retention_days)}
                      onValueChange={(v) => updateLogging("retention_days", Number(v))}
                    >
                      <SelectTrigger className="h-10 bg-background/50"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="30">30 дней</SelectItem>
                        <SelectItem value="60">60 дней</SelectItem>
                        <SelectItem value="90">90 дней</SelectItem>
                        <SelectItem value="180">180 дней</SelectItem>
                        <SelectItem value="365">1 год</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Формат экспорта</Label>
                    <Select
                      value={loggingConfig.export_format}
                      onValueChange={(v) => updateLogging("export_format", v)}
                    >
                      <SelectTrigger className="h-10 bg-background/50"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="json">JSON</SelectItem>
                        <SelectItem value="csv">CSV</SelectItem>
                        <SelectItem value="syslog">Syslog</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Active categories summary */}
              <div className="rounded-xl border border-border/60 bg-card/50 p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Eye className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">Активные категории</span>
                  <Badge variant="secondary" className="text-[10px] ml-auto">
                    {LOGGING_ITEMS.filter((i) => loggingConfig[i.key]).length} из {LOGGING_ITEMS.length}
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-2">
                  {LOGGING_ITEMS.filter((i) => loggingConfig[i.key]).map((i) => (
                    <Badge key={i.key} variant="outline" className="text-[11px] gap-1.5 py-1">
                      <i.icon className="h-3 w-3" /> {i.label}
                    </Badge>
                  ))}
                  {LOGGING_ITEMS.every((i) => !loggingConfig[i.key]) && (
                    <p className="text-xs text-muted-foreground">Все категории отключены</p>
                  )}
                </div>
              </div>
            </>
          )}

          {/* ──── ACTIVITY ──── */}
          {activeSection === "activity" && isAdmin && (
            <>
              <SectionHeader
                title="Журнал действий"
                description="Полная история действий пользователей на платформе"
                icon={Activity}
              />

              {/* Filters */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-[200px] max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={activitySearch}
                    onChange={(e) => setActivitySearch(e.target.value)}
                    placeholder="Поиск по пользователю, действию..."
                    className="pl-10 h-10 bg-background/50"
                  />
                </div>

                <div className="flex items-center gap-1">
                  {DATE_PRESETS.map((preset) => (
                    <Button
                      key={preset.days}
                      size="sm"
                      variant={activityDays === preset.days ? "default" : "outline"}
                      className="h-8 text-xs px-3"
                      onClick={() => {
                        setActivityDays(preset.days);
                        setDateFrom(subDays(new Date(), preset.days || 0));
                        setDateTo(new Date());
                      }}
                    >
                      {preset.label}
                    </Button>
                  ))}
                </div>

                <div className="flex items-center gap-1.5">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 px-3">
                        <CalendarIcon className="h-3.5 w-3.5" />
                        {dateFrom ? format(dateFrom, "dd.MM.yy") : "От"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single" selected={dateFrom} onSelect={setDateFrom}
                        disabled={(date) => date > new Date()}
                        className="p-3 pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                  <span className="text-xs text-muted-foreground">—</span>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 px-3">
                        <CalendarIcon className="h-3.5 w-3.5" />
                        {dateTo ? format(dateTo, "dd.MM.yy") : "До"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single" selected={dateTo} onSelect={setDateTo}
                        disabled={(date) => date > new Date()}
                        className="p-3 pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <Badge variant="outline" className="text-xs shrink-0">
                  {filteredActivity.length} записей
                </Badge>
              </div>

              {/* Table */}
              <div className="rounded-xl border border-border/60 overflow-hidden">
                <div className="max-h-[560px] overflow-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-card z-10">
                      <tr className="text-[11px] text-muted-foreground uppercase border-b border-border">
                        <th className="px-4 py-3 text-left font-medium w-10">Тип</th>
                        <th className="px-4 py-3 text-left font-medium">Пользователь</th>
                        <th className="px-4 py-3 text-left font-medium">Действие</th>
                        <th className="px-4 py-3 text-left font-medium">Описание</th>
                        <th className="px-4 py-3 text-right font-medium w-24">Время</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                      {filteredActivity.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">
                            Нет записей за выбранный период
                          </td>
                        </tr>
                      ) : (
                        filteredActivity.map((event, i) => {
                          const CatIcon = CATEGORY_ICONS[event.category] || Activity;
                          return (
                            <tr key={i} className="hover:bg-muted/20 transition-colors">
                              <td className="px-4 py-3">
                                <div className="h-7 w-7 rounded-lg bg-muted/40 flex items-center justify-center">
                                  <CatIcon className="h-3.5 w-3.5 text-muted-foreground" />
                                </div>
                              </td>
                              <td className="px-4 py-3 font-medium text-foreground whitespace-nowrap">{event.username}</td>
                              <td className="px-4 py-3">
                                <Badge variant="outline" className="text-[10px] font-normal">{event.action}</Badge>
                              </td>
                              <td className="px-4 py-3 text-muted-foreground max-w-xs truncate">{event.description || "—"}</td>
                              <td className="px-4 py-3 text-right text-muted-foreground whitespace-nowrap">
                                {relativeTime(event.timestamp || event.created_at || "")}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

/* ═══════ Helpers ═══════ */

function SectionHeader({ title, description, icon: Icon, actions }: {
  title: string; description: string; icon: React.ElementType; actions?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between mb-1">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        </div>
      </div>
      {actions}
    </div>
  );
}

function InfoPill({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-lg border border-border/60 bg-background/30 px-4 py-3">
      <p className="text-[10px] text-muted-foreground uppercase mb-1">{label}</p>
      <p className={cn("text-sm font-medium", mono && "font-mono")}>{value}</p>
    </div>
  );
}
