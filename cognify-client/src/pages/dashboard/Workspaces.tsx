import React, { useState, useEffect } from "react";
import { 
  FolderOpen, 
  Users, 
  Bot, 
  Activity, 
  ChevronRight, 
  Plus, 
  FileText, 
  MessageSquare, 
  Settings as SettingsIcon, 
  BarChart2, 
  Trash2,
  Lock,
  Globe,
  GitFork,
  Brain,
  UploadCloud,
  CheckCircle,
  XCircle,
  Clock,
  Play,
  Bell,
  MoreHorizontal,
  Mail,
  UserPlus,
  ChevronDown,
  UserCheck,
  Cpu,
  Database,
  Zap
} from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { api } from "../../utils/api";
import { Files } from "./Files";
import { Workflows } from "./Workflows";
import { Memory } from "./Memory";
import { Collaboration } from "./Collaboration";

export const Workspaces = () => {
  const [workspaces, setWorkspaces] = useState<any[]>([]);
  const [selectedWsId, setSelectedWsId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "files" | "workflows" | "memory" | "collaboration" | "members" | "settings">("overview");
  const [loading, setLoading] = useState(true);

  const [newWsName, setNewWsName] = useState("");
  const [newWsDesc, setNewWsDesc] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [myTeams, setMyTeams] = useState<any[]>([]);
  const [wsFiles, setWsFiles] = useState<any[]>([]);
  const [wsWorkflows, setWsWorkflows] = useState<any[]>([]);

  // Tab 6 & 7 Additional States
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmailInput, setInviteEmailInput] = useState("");
  const [inviteRoleInput, setInviteRoleInput] = useState<"ADMIN" | "EDITOR" | "VIEWER">("VIEWER");
  const [inviteSuccessMsg, setInviteSuccessMsg] = useState("");

  const [wsNameInput, setWsNameInput] = useState("");
  const [wsDescInput, setWsDescInput] = useState("");
  const [wsColor, setWsColor] = useState("orange");
  const [require2FA, setRequire2FA] = useState(false);
  const [auditLogging, setAuditLogging] = useState(true);
  const [tokenLimit, setTokenLimit] = useState(5000000);
  const [alertThreshold, setAlertThreshold] = useState(80);

  useEffect(() => {
    const active = workspaces.find((w) => w.id === selectedWsId);
    if (active) {
      setWsNameInput(active.name || "");
      setWsDescInput(active.description || "");
    }
  }, [selectedWsId, workspaces]);

  const fetchWorkspaces = async () => {
    try {
      setLoading(true);
      const res = await api.get("/workspaces");
      setWorkspaces(res.data);
      const savedWsId = localStorage.getItem("activeWorkspaceId");
      if (savedWsId && res.data.some((w: any) => w.id === savedWsId)) {
        setSelectedWsId(savedWsId);
      } else if (res.data.length > 0) {
        setSelectedWsId(res.data[0].id);
        localStorage.setItem("activeWorkspaceId", res.data[0].id);
      }
    } catch (err) {
      console.error("Failed to fetch workspaces:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchTeamMembers = async () => {
    try {
      const res = await api.get("/teams/my-teams");
      setMyTeams(res.data || []);
    } catch (err) {
      console.error("Failed to fetch team members:", err);
      setMyTeams([]);
    }
  };

  useEffect(() => {
    if (!selectedWsId) {
      setWsFiles([]);
      setWsWorkflows([]);
      return;
    }

    api.get(`/files/${selectedWsId}`)
      .then((res) => setWsFiles(res.data || []))
      .catch(() => setWsFiles([]));

    api.get(`/workflows/${selectedWsId}`)
      .then((res) => setWsWorkflows(res.data || []))
      .catch(() => setWsWorkflows([]));
  }, [selectedWsId]);

  useEffect(() => {
    fetchWorkspaces();
    fetchTeamMembers();

    const handleWorkspaceSwitched = () => {
      setSelectedWsId(localStorage.getItem("activeWorkspaceId"));
    };

    const handleWorkspacesListChanged = () => {
      fetchWorkspaces();
    };

    window.addEventListener("activeWorkspaceIdChanged", handleWorkspaceSwitched);
    window.addEventListener("workspacesChanged", handleWorkspacesListChanged);
    return () => {
      window.removeEventListener("activeWorkspaceIdChanged", handleWorkspaceSwitched);
      window.removeEventListener("workspacesChanged", handleWorkspacesListChanged);
    };
  }, []);

  const selectedWorkspace = workspaces.find((w) => w.id === selectedWsId);

  // Compute workspace members dynamically
  const workspaceMembers = React.useMemo(() => {
    const membersMap = new Map<string, any>();

    // Owner is admin
    if (selectedWorkspace?.user) {
      const owner = selectedWorkspace.user;
      membersMap.set(owner.id, {
        id: "owner-" + owner.id,
        name: owner.name || owner.email.split("@")[0],
        email: owner.email,
        role: "ADMIN",
        joinedAt: selectedWorkspace.created_at,
        initials: (owner.name || "U").split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2),
        isOwner: true
      });
    }

    // Team members
    myTeams.forEach((membership: any) => {
      const team = membership.team;
      if (team?.team_workspaces?.some((tw: any) => tw.workspace_id === selectedWsId)) {
        team.members?.forEach((m: any) => {
          if (m.user) {
            const u = m.user;
            if (!membersMap.has(u.id)) {
              membersMap.set(u.id, {
                id: m.id,
                name: u.name || u.email.split("@")[0],
                email: u.email,
                role: m.role || "VIEWER",
                joinedAt: m.joined_at,
                initials: (u.name || "U").split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2),
                isOwner: false,
                teamId: team.id
              });
            }
          }
        });
      }
    });

    return Array.from(membersMap.values());
  }, [myTeams, selectedWsId, selectedWorkspace]);

  // Compute recent activity dynamically
  const recentActivity = React.useMemo(() => {
    const list: any[] = [];
    wsFiles.forEach(f => {
      list.push({
        text: `File '${f.original_name || f.filename}' uploaded`,
        time: new Date(f.created_at),
        timeString: new Date(f.created_at).toLocaleDateString() + " " + new Date(f.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        dot: f.parsed_text ? "bg-[#2d9e6b]" : "bg-[#d97706]"
      });
    });
    wsWorkflows.forEach(w => {
      list.push({
        text: `Workflow '${w.name}' created`,
        time: new Date(w.created_at),
        timeString: new Date(w.created_at).toLocaleDateString() + " " + new Date(w.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        dot: "bg-white"
      });
    });
    workspaceMembers.filter(m => !m.isOwner).forEach(m => {
      list.push({
        text: `Member '${m.name}' joined workspace`,
        time: new Date(m.joinedAt),
        timeString: new Date(m.joinedAt).toLocaleDateString() + " " + new Date(m.joinedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        dot: "bg-blue-500"
      });
    });

    list.sort((a, b) => b.time.getTime() - a.time.getTime());
    return list.slice(0, 5);
  }, [wsFiles, wsWorkflows, workspaceMembers]);

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWsName.trim()) return;

    try {
      const res = await api.post("/workspaces", {
        name: newWsName,
        description: newWsDesc
      });
      const newWs = res.data;
      setWorkspaces((prev) => [...prev, newWs]);
      setSelectedWsId(newWs.id);
      localStorage.setItem("activeWorkspaceId", newWs.id);

      setNewWsName("");
      setNewWsDesc("");
      setShowCreateModal(false);

      window.dispatchEvent(new Event("workspacesChanged"));
      window.dispatchEvent(new Event("activeWorkspaceIdChanged"));
    } catch (err) {
      console.error("Failed to create workspace:", err);
      alert("Failed to create workspace. Please check backend.");
    }
  };

  const handleDeleteWorkspace = async (id: string) => {
    if (!confirm("Are you sure you want to delete this workspace? This cannot be undone.")) return;
    try {
      await api.delete(`/workspaces/${id}`);
      setWorkspaces((prev) => prev.filter((w) => w.id !== id));
      setSelectedWsId(null);
      localStorage.removeItem("activeWorkspaceId");
      window.dispatchEvent(new Event("workspacesChanged"));
      window.dispatchEvent(new Event("activeWorkspaceIdChanged"));
      alert("Workspace deleted successfully.");
    } catch (err: any) {
      console.error("Failed to delete workspace:", err);
      alert(err.response?.data?.message || "Failed to delete workspace.");
    }
  };

  return (
    <div className="flex flex-col gap-6 select-none h-full">
      {/* Create Workspace Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-950 border border-white/10 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl p-6 text-left">
            <h3 className="text-base font-semibold text-white leading-none">Create New Workspace</h3>
            <p className="text-xs text-zinc-400 mt-2">Initialize a space to group AI agents, prompts, and knowledge files.</p>
            
            <form onSubmit={handleCreateWorkspace} className="flex flex-col gap-4 mt-6">
              <div className="flex flex-col gap-2">
                <label className="text-xs text-zinc-400 font-medium">Workspace Name</label>
                <input
                  type="text"
                  placeholder="e.g. Legal Research Hub"
                  value={newWsName}
                  onChange={(e) => setNewWsName(e.target.value)}
                  className="bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2 text-sm text-white placeholder-zinc-500 focus:border-zinc-500 outline-none"
                  required
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs text-zinc-400 font-medium">Description</label>
                <textarea
                  rows={3}
                  placeholder="Summarize the purpose of this space..."
                  value={newWsDesc}
                  onChange={(e) => setNewWsDesc(e.target.value)}
                  className="bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2 text-sm text-white placeholder-zinc-500 focus:border-zinc-500 outline-none resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 mt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-800 rounded-xl text-xs font-semibold cursor-pointer transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-white hover:bg-zinc-200 !text-black rounded-xl text-xs font-semibold transition-all shadow-sm cursor-pointer"
                >
                  Create Space
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Header bar */}
      <div className="flex items-center justify-between text-left">
        <div>
          {selectedWorkspace && (
            <span className="text-[10px] text-zinc-400 font-mono font-semibold uppercase tracking-[0.08em] block mb-1">ACTIVE WORKSPACE</span>
          )}
          <h1 className="text-2xl font-semibold text-white tracking-tight leading-none">
            {selectedWorkspace ? selectedWorkspace.name : "Workspace Ecosystem"}
          </h1>
          <p className="text-xs text-zinc-400 mt-2">
            {selectedWorkspace 
              ? selectedWorkspace.description 
              : "Isolated logical namespaces containing files, context records, and AI pipelines."}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-zinc-200 !text-black text-xs font-semibold shadow-sm transition-all cursor-pointer"
        >
          <Plus className="h-4 w-4" /> Create Space
        </button>
      </div>

      {/* Grid listing when no workspace selected */}
      {!selectedWorkspace ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {workspaces.map((ws) => (
            <div
              key={ws.id}
              onClick={() => {
                setSelectedWsId(ws.id);
                setActiveTab("overview");
              }}
              className="rounded-xl p-5 cursor-pointer flex flex-col justify-between h-48 border border-white/10 bg-zinc-950/80 hover:border-white/20 hover:bg-zinc-900/60 transition-all shadow-sm group"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-white">{ws.name}</span>
                  <ChevronRight className="h-4 w-4 text-zinc-500 group-hover:text-white transition-colors" />
                </div>
                <p className="text-xs text-zinc-400 mt-2.5 line-clamp-2 leading-relaxed text-left">
                  {ws.description}
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-between border-t border-white/10 pt-4 mt-4 text-[10.5px] text-zinc-400 font-medium">
                <div className="flex gap-4">
                  <span className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5" /> {ws.membersCount}</span>
                  <span className="flex items-center gap-1.5"><Bot className="h-3.5 w-3.5" /> {ws.activeAgentsCount}</span>
                  <span className="flex items-center gap-1.5"><FolderOpen className="h-3.5 w-3.5" /> {ws.filesCount}</span>
                </div>
                <span className="font-mono text-zinc-500">Active {ws.lastActivity}</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        // Detailed View: Notion-like Layout
        <div className="flex-1 flex flex-col border border-white/10 rounded-2xl bg-zinc-950/80 overflow-hidden min-h-[400px] shadow-sm">
          {/* Notion Header breadcrumb navigation */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/10 bg-black/60">
            <button 
              onClick={() => setSelectedWsId(null)}
              className="text-xs text-zinc-400 hover:text-white font-medium transition-colors cursor-pointer"
            >
              ← Back to Workspaces
            </button>
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="text-[10px] text-zinc-400 font-mono uppercase tracking-wider">Sync Config Active</span>
            </div>
          </div>
          {/* Notion-style Tabs */}
          <div className="flex border-b border-white/10 bg-black/40 px-2 overflow-x-auto shrink-0 scrollbar-none relative z-10">
            {[
              { id: "overview", label: "Overview", icon: Activity },
              { id: "files", label: "Files", icon: FolderOpen },
              { id: "workflows", label: "Workflows", icon: GitFork },
              { id: "memory", label: "Memory", icon: Brain },
              { id: "collaboration", label: "Collaboration", icon: MessageSquare },
              { id: "members", label: "Members", icon: Users },
              { id: "settings", label: "Settings", icon: SettingsIcon },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-2 px-4 py-3 border-b-2 text-xs font-medium transition-all cursor-pointer whitespace-nowrap ${
                    isActive 
                      ? "border-white text-white bg-white/5 font-semibold" 
                      : "border-transparent text-zinc-400 hover:text-white hover:bg-white/[0.02]"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Tab Content Display */}
          <div className="flex-1 p-5 overflow-y-auto bg-transparent relative">
            {/* Overview Tab */}
            {activeTab === "overview" && (
              <div className="flex flex-col gap-6 text-left">
                {/* Stat Cards Row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {[
                    { id: 1, label: "Members", value: workspaceMembers.length.toString(), icon: Users },
                    { id: 2, label: "Files indexed", value: wsFiles.length.toString(), icon: FileText },
                    { id: 3, label: "Active agents", value: "5", icon: Bot },
                    { id: 4, label: "Active Workflows", value: wsWorkflows.length.toString(), icon: Zap },
                  ].map((card) => {
                    const Icon = card.icon;
                    return (
                      <div
                        key={card.id}
                        className="rounded-xl border border-zinc-800 bg-zinc-900/80 p-4 flex flex-col justify-between"
                      >
                        <div className="flex items-center justify-between w-full text-zinc-400">
                          <span className="font-mono text-[10.5px] uppercase tracking-wider">{card.label}</span>
                          <Icon className="size-4 text-zinc-400" />
                        </div>
                        <span className="font-mono text-2xl font-bold text-white mt-3 tracking-tight">{card.value}</span>
                      </div>
                    );
                  })}
                </div>

                {/* Quick Actions Row */}
                <div className="flex flex-col gap-2.5">
                  <span className="font-mono text-[10.5px] font-semibold text-zinc-400 uppercase tracking-wider">QUICK ACTIONS</span>
                  <div className="flex flex-wrap gap-2.5">
                    <button
                      onClick={() => {
                        window.location.href = "/dashboard/chat";
                      }}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-zinc-200 !text-black text-xs font-semibold shadow-sm transition-all cursor-pointer"
                    >
                      <Plus className="h-4 w-4" /> New Chat
                    </button>
                    <button
                      onClick={() => setActiveTab("files")}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-zinc-800 bg-zinc-900/60 hover:bg-zinc-900 hover:border-zinc-700 text-xs font-medium text-white transition-all cursor-pointer"
                    >
                      <UploadCloud className="h-4 w-4 text-zinc-400" /> Upload File
                    </button>
                    <button
                      onClick={() => {
                        setActiveTab("members");
                        setInviteOpen(true);
                      }}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-zinc-800 bg-zinc-900/60 hover:bg-zinc-900 hover:border-zinc-700 text-xs font-medium text-white transition-all cursor-pointer"
                    >
                      <Plus className="h-4 w-4 text-zinc-400" /> Invite Member
                    </button>
                    <button
                      onClick={() => setActiveTab("workflows")}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-zinc-800 bg-zinc-900/60 hover:bg-zinc-900 hover:border-zinc-700 text-xs font-medium text-white transition-all cursor-pointer"
                    >
                      <Zap className="h-4 w-4 text-zinc-400" /> New Workflow
                    </button>
                  </div>
                </div>

                <div className="h-px bg-white/10 my-1" />

                {/* Context Files Section */}
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10.5px] font-semibold text-zinc-400 uppercase tracking-[0.08em]">CONTEXT FILES</span>
                    <span
                      onClick={() => setActiveTab("files")}
                      className="text-xs font-semibold text-zinc-300 hover:text-white hover:underline cursor-pointer"
                    >
                      Manage Files
                    </span>
                  </div>

                  <div className="flex flex-col gap-1 border border-white/10 rounded-xl overflow-hidden bg-zinc-950/80 shadow-sm">
                    {wsFiles.length === 0 ? (
                      <div className="p-4 text-center text-xs text-zinc-400 font-semibold">
                        No context files uploaded yet.
                      </div>
                    ) : (
                      wsFiles.slice(0, 5).map((file, idx) => {
                        const fileSizeMB = `${(file.size / (1024 * 1024)).toFixed(1)} MB`;
                        const isReady = file.parsed_text ? true : false;
                        return (
                          <div key={idx} className="flex items-center justify-between p-3.5 border-b border-zinc-800/80 last:border-b-0 hover:bg-zinc-900/40 transition-colors">
                            <div className="flex items-center gap-2.5 overflow-hidden">
                              <FileText className="h-4.5 w-4.5 text-zinc-400 shrink-0" />
                              <span className="text-xs font-medium text-white truncate max-w-[200px] sm:max-w-md">{file.original_name || file.filename}</span>
                              <span className="font-mono text-[11px] text-zinc-500">{fileSizeMB}</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className={`text-[9.5px] px-2 py-0.5 rounded font-mono uppercase tracking-wider ${
                                isReady 
                                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" 
                                  : "bg-zinc-800 text-zinc-400 border border-zinc-700"
                              }`}>
                                {isReady ? "Ready" : "Indexing"}
                              </span>
                              <span className="font-mono text-[11px] text-zinc-500">{new Date(file.created_at).toLocaleDateString()}</span>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                <div className="h-px bg-white/10 my-1" />

                {/* Team Access Section */}
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10.5px] font-semibold text-zinc-400 uppercase tracking-[0.08em]">TEAM ACCESS</span>
                    <span
                      onClick={() => setActiveTab("collaboration")}
                      className="text-xs font-semibold text-zinc-300 hover:text-white hover:underline cursor-pointer"
                    >
                      Manage Teams
                    </span>
                  </div>

                  <div className="flex flex-col gap-1 border border-white/10 rounded-xl overflow-hidden bg-zinc-950/80 shadow-sm">
                    {workspaceMembers.length === 0 ? (
                      <div className="p-4 text-center text-xs text-zinc-400 font-semibold">
                        No team members added yet.
                      </div>
                    ) : (
                      workspaceMembers.slice(0, 3).map((member, idx) => {
                        const colorClass = member.role === "ADMIN" 
                          ? "bg-white/10 text-white border border-white/20" 
                          : member.role === "EDITOR" 
                            ? "bg-zinc-800 text-zinc-200 border border-zinc-700" 
                            : "bg-zinc-900 text-zinc-400 border border-zinc-800";
                        return (
                          <div key={idx} className="flex items-center justify-between p-3.5 border-b border-zinc-800/80 last:border-b-0 hover:bg-zinc-900/40 transition-colors">
                            <div className="flex items-center gap-3">
                              <div className={`h-7 w-7 rounded-full flex items-center justify-center text-[10.5px] font-bold ${colorClass}`}>
                                {member.initials}
                              </div>
                              <span className="text-xs font-medium text-white">{member.name} {member.isOwner && "(Owner)"}</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className={`text-[9.5px] px-2 py-0.5 rounded font-mono uppercase tracking-wider ${colorClass}`}>
                                {member.role}
                              </span>
                              <span className="font-mono text-[11px] text-zinc-500">joined {new Date(member.joinedAt).toLocaleDateString()}</span>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                <div className="h-px bg-white/10 my-1" />

                {/* Recent Activity Feed */}
                <div className="flex flex-col gap-3">
                  <span className="font-mono text-[10.5px] font-semibold text-zinc-400 uppercase tracking-[0.08em]">RECENT ACTIVITY</span>
                  <div className="flex flex-col border border-white/10 rounded-xl overflow-hidden bg-zinc-950/80 shadow-sm">
                    {recentActivity.length === 0 ? (
                      <div className="p-4 text-center text-xs text-zinc-400 font-semibold">
                        No recent activity logged.
                      </div>
                    ) : (
                      recentActivity.map((act, idx) => (
                        <div key={idx} className="flex items-center justify-between p-3.5 border-b border-zinc-800/80 last:border-b-0 text-xs text-zinc-400 hover:bg-zinc-900/40 transition-colors">
                          <div className="flex items-center gap-2.5">
                            <span className={`h-1.5 w-1.5 rounded-full ${act.dot}`} />
                            <span className="text-zinc-300">{act.text}</span>
                          </div>
                          <span className="font-mono text-[11px] text-zinc-500">{act.timeString}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Files Tab */}
            {activeTab === "files" && (
              <Files />
            )}

            {/* Workflows Tab */}
            {activeTab === "workflows" && (
              <Workflows />
            )}

            {/* Memory Tab */}
            {activeTab === "memory" && (
              <Memory />
            )}

            {/* Collaboration Tab */}
            {activeTab === "collaboration" && (
              <Collaboration />
            )}

            {/* Members Tab */}
            {activeTab === "members" && (
              <div className="flex flex-col gap-6 text-left">
                {/* Header Row */}
                <div className="flex justify-between items-center border-b border-white/10 pb-3 mb-2">
                  <div>
                    <h2 className="text-lg font-semibold text-white tracking-tight">Workspace Members</h2>
                    <p className="text-xs text-zinc-400 mt-1">Manage who has access to this workspace and their permission level.</p>
                  </div>
                  <button
                    onClick={() => setInviteOpen(!inviteOpen)}
                    className="flex items-center gap-1.5 px-4 py-2 bg-white hover:bg-zinc-200 !text-black rounded-xl text-xs font-semibold shadow-sm transition-all cursor-pointer"
                  >
                    <UserPlus className="h-4 w-4" /> Invite Member
                  </button>
                </div>

                {/* Collapsible Invite Bar */}
                {inviteOpen && (
                  <div className="p-4 rounded-xl border border-white/15 bg-zinc-900/80 flex flex-col gap-3 transition-all">
                    <span className="text-[10px] font-mono font-semibold text-zinc-300 uppercase tracking-wider">Invite Workspace Member</span>
                    <form
                      onSubmit={async (e) => {
                        e.preventDefault();
                        if (!inviteEmailInput.trim() || !selectedWsId) return;
                        try {
                          let teamId = "";
                          const existingTeamWorkspace = selectedWorkspace?.team_workspaces?.[0];
                          if (existingTeamWorkspace) {
                            teamId = existingTeamWorkspace.team_id;
                          } else {
                            const createTeamRes = await api.post("/teams/create", { name: `${selectedWorkspace.name} Team` });
                            teamId = createTeamRes.data.id;
                            await api.post(`/teams/${teamId}/workspaces/${selectedWsId}`);
                          }

                          await api.post(`/teams/${teamId}/invite`, {
                            email: inviteEmailInput,
                            role: inviteRoleInput
                          });

                          setInviteSuccessMsg(`Successfully invited ${inviteEmailInput} as ${inviteRoleInput}`);
                          setInviteEmailInput("");
                          fetchTeamMembers();
                          fetchWorkspaces();
                          setTimeout(() => setInviteSuccessMsg(""), 4000);
                        } catch (err: any) {
                          alert(err.response?.data?.message || "Failed to invite member. Make sure user exists.");
                        }
                      }}
                      className="flex flex-col sm:flex-row gap-3 items-end sm:items-center"
                    >
                      <input
                        type="email"
                        placeholder="user@example.com"
                        value={inviteEmailInput}
                        onChange={(e) => setInviteEmailInput(e.target.value)}
                        className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-500 focus:border-white/40 outline-none h-[36px]"
                        required
                      />
                      <select
                        value={inviteRoleInput}
                        onChange={(e) => setInviteRoleInput(e.target.value as any)}
                        className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:border-white/40 outline-none h-[36px] w-full sm:w-[130px] cursor-pointer"
                      >
                        <option value="VIEWER">Viewer</option>
                        <option value="EDITOR">Editor</option>
                        <option value="ADMIN">Admin</option>
                      </select>
                      <button
                        type="submit"
                        className="px-4 py-2 bg-white hover:bg-zinc-200 !text-black rounded-xl text-xs font-semibold h-[36px] transition-all cursor-pointer w-full sm:w-auto shrink-0"
                      >
                        Send Invite
                      </button>
                    </form>
                    {inviteSuccessMsg && (
                      <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium rounded-lg">
                        {inviteSuccessMsg}
                      </div>
                    )}
                  </div>
                )}

                {/* Members Table */}
                <div className="border border-white/10 rounded-xl overflow-hidden bg-zinc-950/80 shadow-sm">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-black/50 border-b border-white/10 text-[10px] font-mono text-zinc-400 uppercase tracking-[0.08em]">
                        <th className="p-3.5 pl-5">MEMBER</th>
                        <th className="p-3.5">ROLE</th>
                        <th className="p-3.5">JOINED</th>
                        <th className="p-3.5">LAST ACTIVE</th>
                        <th className="p-3.5 text-right pr-5">ACTIONS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {workspaceMembers.map((member, idx) => {
                        const colorClass = member.role === "ADMIN" 
                          ? "bg-white/10 text-white border border-white/20" 
                          : member.role === "EDITOR" 
                            ? "bg-zinc-800 text-zinc-200 border border-zinc-700" 
                            : "bg-zinc-900 text-zinc-400 border border-zinc-800";
                        return (
                          <tr key={idx} className="border-b border-zinc-800/80 last:border-b-0 hover:bg-zinc-900/40 group transition-all text-xs text-zinc-300">
                            <td className="p-3.5 pl-5 flex items-center gap-3">
                              <div className={`h-8 w-8 rounded-full flex items-center justify-center font-bold text-[11px] ${colorClass}`}>
                                {member.initials}
                              </div>
                              <div className="flex flex-col text-left">
                                <span className="font-semibold text-white">{member.name} {member.isOwner && "(Owner)"}</span>
                                <span className="text-[11px] text-zinc-400">{member.email}</span>
                              </div>
                            </td>
                            <td className="p-3.5">
                              <select
                                defaultValue={member.role}
                                disabled={member.isOwner}
                                onChange={async (e) => {
                                  const newRole = e.target.value;
                                  try {
                                    await api.put(`/teams/${member.teamId}/members/${member.id}/role`, { role: newRole });
                                    alert("Role updated successfully!");
                                    fetchTeamMembers();
                                  } catch (err: any) {
                                    alert(err.response?.data?.message || "Failed to update role");
                                  }
                                }}
                                className="text-[10px] font-mono rounded px-2.5 py-1 outline-none border cursor-pointer bg-zinc-900 text-zinc-200 border-zinc-800"
                              >
                                <option value="ADMIN">Admin</option>
                                <option value="EDITOR">Editor</option>
                                <option value="VIEWER">Viewer</option>
                              </select>
                            </td>
                            <td className="p-3.5 font-mono text-zinc-400">{new Date(member.joinedAt || Date.now()).toLocaleDateString()}</td>
                            <td className="p-3.5 text-zinc-500">—</td>
                            <td className="p-3.5 text-right pr-5">
                              <button
                                disabled={member.isOwner}
                                onClick={async () => {
                                  if (!confirm(`Are you sure you want to remove ${member.name} from the team?`)) return;
                                  try {
                                    await api.delete(`/teams/${member.teamId}/members/${member.id}`);
                                    alert("Member removed successfully!");
                                    fetchTeamMembers();
                                  } catch (err: any) {
                                    alert(err.response?.data?.message || "Failed to remove member");
                                  }
                                }}
                                className="text-xs font-semibold text-red-400 hover:text-red-300 hover:underline disabled:opacity-0 cursor-pointer disabled:cursor-default"
                              >
                                Remove
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Settings Tab */}
            {activeTab === "settings" && (
              <div className="flex flex-col gap-6 text-left">
                {/* Section 1 — Workspace Identity */}
                <div className="flex flex-col gap-3">
                  <h3 className="text-sm font-semibold text-white tracking-tight">Workspace Identity</h3>
                  <div className="flex flex-col gap-4 bg-zinc-900/60 border border-white/10 rounded-xl p-5 shadow-sm">
                    <div className="flex flex-col gap-1.5">
                      <span className="text-[11px] font-mono font-semibold text-zinc-400 uppercase tracking-wider">Workspace Name</span>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={wsNameInput}
                          onChange={(e) => setWsNameInput(e.target.value)}
                          className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:border-zinc-500 outline-none h-[34px]"
                        />
                        <button
                          onClick={async () => {
                            if (!wsNameInput.trim()) return;
                            try {
                              await api.put(`/workspaces/${selectedWorkspace.id}`, { name: wsNameInput });
                              alert("Workspace name updated!");
                              fetchWorkspaces();
                            } catch (err) {
                              alert("Failed to update workspace name");
                            }
                          }}
                          className="px-4 bg-white hover:bg-zinc-200 !text-black rounded-lg text-xs font-semibold h-[34px] transition-all cursor-pointer border-none"
                        >
                          Save
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <span className="text-[11px] font-mono font-semibold text-zinc-400 uppercase tracking-wider">Description</span>
                      <div className="flex gap-2 items-end">
                        <textarea
                          rows={2}
                          value={wsDescInput}
                          onChange={(e) => setWsDescInput(e.target.value)}
                          className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white placeholder-zinc-500 focus:border-zinc-500 outline-none resize-none"
                        />
                        <button
                          onClick={async () => {
                            try {
                              await api.put(`/workspaces/${selectedWorkspace.id}`, { description: wsDescInput });
                              alert("Workspace description updated!");
                              fetchWorkspaces();
                            } catch (err) {
                              alert("Failed to update workspace description");
                            }
                          }}
                          className="px-4 bg-white hover:bg-zinc-200 !text-black rounded-lg text-xs font-semibold h-[34px] transition-all cursor-pointer shrink-0 border-none"
                        >
                          Save
                        </button>
                      </div>
                    </div>

                    {/* Workspace color icon picker */}
                    <div className="flex flex-col gap-1.5">
                      <span className="text-[11px] font-mono font-semibold text-zinc-400 uppercase tracking-wider">Workspace Brand Color</span>
                      <div className="flex gap-2.5 mt-1">
                        {[
                          { name: "white", hex: "#ffffff" },
                          { name: "zinc", hex: "#71717a" },
                          { name: "blue", hex: "#3b82f6" },
                          { name: "purple", hex: "#8b5cf6" },
                          { name: "green", hex: "#2d9e6b" },
                          { name: "amber", hex: "#d97706" },
                          { name: "red", hex: "#dc2626" },
                          { name: "gray", hex: "#27272a" }
                        ].map((color) => (
                          <button
                            key={color.name}
                            onClick={() => setWsColor(color.name)}
                            style={{ backgroundColor: color.hex }}
                            className={`h-[22px] w-[22px] rounded-full transition-all border border-black/10 relative flex items-center justify-center cursor-pointer hover:scale-110 ${
                              wsColor === color.name
                                ? "ring-2 ring-offset-2 ring-white/50"
                                : ""
                            }`}
                          >
                            {wsColor === color.name && (
                              <span className="text-white text-[9.5px] font-bold">✓</span>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Section 2 — Security and Access */}
                <div className="flex flex-col gap-3">
                  <h3 className="text-sm font-semibold text-white tracking-tight">Security and Access</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-4 rounded-xl border border-white/10 bg-zinc-900/60 flex items-center justify-between h-full">
                      <div className="text-left max-w-[80%]">
                        <p className="text-xs font-semibold text-white">Public Discoverability</p>
                        <p className="text-[10.5px] text-zinc-400 mt-1 leading-normal">Make workspace searchable for directory indexers.</p>
                      </div>
                      <button className="h-5 w-9 rounded-full bg-zinc-800 p-0.5 relative transition-all border border-white/10">
                        <span className="h-4 w-4 rounded-full bg-zinc-500 block"></span>
                      </button>
                    </div>
                    <div className="p-4 rounded-xl border border-white/10 bg-zinc-900/60 flex items-center justify-between h-full">
                      <div className="text-left max-w-[80%]">
                        <p className="text-xs font-semibold text-white">Isolated Sandbox</p>
                        <p className="text-[10.5px] text-zinc-400 mt-1 leading-normal">Isolate agent processes memory blocks runtime execution.</p>
                      </div>
                      <button className="h-5 w-9 rounded-full bg-white/20 p-0.5 relative transition-all flex justify-end border border-white/10">
                        <span className="h-4 w-4 rounded-full bg-white block"></span>
                      </button>
                    </div>
                    <div className="p-4 rounded-xl border border-white/10 bg-zinc-900/60 flex items-center justify-between h-full">
                      <div className="text-left max-w-[80%]">
                        <p className="text-xs font-semibold text-white">Require 2FA for all members</p>
                        <p className="text-[10.5px] text-zinc-400 mt-1 leading-normal">Members must have two-factor authentication enabled.</p>
                      </div>
                      <button
                        onClick={() => setRequire2FA(!require2FA)}
                        className={`h-5 w-9 rounded-full p-0.5 relative transition-all flex border border-white/10 ${require2FA ? "bg-white/20 justify-end" : "bg-zinc-800 justify-start"}`}
                      >
                        <span className={`h-4 w-4 rounded-full block ${require2FA ? "bg-white" : "bg-zinc-500"}`}></span>
                      </button>
                    </div>
                    <div className="p-4 rounded-xl border border-white/10 bg-zinc-900/60 flex items-center justify-between h-full">
                      <div className="text-left max-w-[80%]">
                        <p className="text-xs font-semibold text-white">Activity audit logging</p>
                        <p className="text-[10.5px] text-zinc-400 mt-1 leading-normal">Log all file access, agent runs, and config changes.</p>
                      </div>
                      <button
                        onClick={() => setAuditLogging(!auditLogging)}
                        className={`h-5 w-9 rounded-full p-0.5 relative transition-all flex border border-white/10 ${auditLogging ? "bg-white/20 justify-end" : "bg-zinc-800 justify-start"}`}
                      >
                        <span className={`h-4 w-4 rounded-full block ${auditLogging ? "bg-white" : "bg-zinc-500"}`}></span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Section 3 — Token Budget */}
                <div className="flex flex-col gap-3">
                  <h3 className="text-sm font-semibold text-white tracking-tight">Token Budget</h3>
                  <p className="text-xs text-zinc-400 -mt-1.5">Set a monthly token limit for this workspace to control costs.</p>
                  
                  <div className="flex flex-col gap-4 bg-zinc-900/60 border border-white/10 rounded-xl p-5 shadow-sm">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                      <div className="text-left">
                        <span className="text-xs font-semibold text-white">Monthly token limit</span>
                        <p className="text-[10.5px] text-zinc-400 mt-0.5">Define maximum monthly API tokens consumed.</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          value={tokenLimit}
                          onChange={(e) => setTokenLimit(parseInt(e.target.value) || 0)}
                          className="bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:border-zinc-500 outline-none w-[110px] font-mono text-right"
                        />
                        <span className="text-xs text-zinc-400 font-mono">tokens</span>
                      </div>
                    </div>
                    <div className="text-[11px] text-zinc-300 bg-white/5 border border-white/10 px-3 py-2 rounded-lg -mt-1 font-mono">
                      At current usage, this workspace will hit the limit in ~18 days.
                    </div>

                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pt-3 border-t border-white/10">
                      <div className="text-left">
                        <span className="text-xs font-semibold text-white">Alert threshold</span>
                        <p className="text-[10.5px] text-zinc-400 mt-0.5">Send alert when tokens consumption reaches this percentage.</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          value={alertThreshold}
                          onChange={(e) => setAlertThreshold(parseInt(e.target.value) || 0)}
                          className="bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:border-zinc-500 outline-none w-[60px] font-mono text-right"
                        />
                        <span className="text-xs text-zinc-400 font-mono">%</span>
                      </div>
                    </div>

                    <button
                      onClick={() => alert("Token budget configurations updated!")}
                      className="self-end px-4 py-2 bg-white hover:bg-zinc-200 !text-black rounded-lg text-xs font-semibold transition-all cursor-pointer"
                    >
                      Save budget settings
                    </button>
                  </div>
                </div>

                {/* Section 4 — Audit Log Preview */}
                <div className="flex flex-col gap-3">
                  <div className="flex justify-between items-center">
                    <h3 className="text-sm font-semibold text-white tracking-tight">Recent Audit Log</h3>
                    <span onClick={() => alert("Redirecting to full audit reports index...")} className="text-xs font-semibold text-zinc-300 hover:text-white hover:underline cursor-pointer">
                      View full log →
                    </span>
                  </div>

                  <div className="border border-white/10 rounded-xl overflow-hidden bg-zinc-950/80 shadow-sm">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-black/60 border-b border-white/10 text-[10px] font-mono text-zinc-400 uppercase tracking-wider">
                          <th className="p-3.5 pl-5">ACTION</th>
                          <th className="p-3.5">ACTOR</th>
                          <th className="p-3.5">RESOURCE</th>
                          <th className="p-3.5 text-right pr-5">TIMESTAMP</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td colSpan={4} className="p-6 text-center text-xs text-zinc-500 font-mono">
                            No activity logs recorded yet.
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Section 5 — Danger Zone */}
                <div className="border-t border-white/10 pt-6">
                  <h4 className="text-xs font-mono font-semibold uppercase tracking-wider text-red-400">Danger Zone</h4>
                  <div className="flex flex-col gap-3 mt-3">
                    {/* Transfer Ownership Card */}
                    <div className="p-4 rounded-xl border border-red-950/40 bg-red-950/10 flex items-center justify-between">
                      <div className="text-left">
                        <p className="text-xs font-semibold text-red-300">Transfer Ownership</p>
                        <p className="text-[10.5px] text-zinc-400 mt-1">Transfer this workspace to another admin member in organization.</p>
                      </div>
                      <button
                        onClick={() => alert("Please specify the recipient administrator in members list.")}
                        className="px-3.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 text-xs font-medium transition-all cursor-pointer"
                      >
                        Transfer
                      </button>
                    </div>

                    {/* Delete Workspace Card */}
                    <div className="p-4 rounded-xl border border-red-950/40 bg-red-950/10 flex items-center justify-between">
                      <div className="text-left">
                        <p className="text-xs font-semibold text-red-300">Delete Workspace</p>
                        <p className="text-[10.5px] text-zinc-400 mt-1">
                          Permanently purge database links, indexing metrics, and configurations. This is irreversible.
                        </p>
                      </div>
                      <button
                        onClick={() => handleDeleteWorkspace(selectedWorkspace.id)}
                        className="px-3.5 py-1.5 rounded-lg bg-red-950/60 hover:bg-red-900/80 border border-red-900/60 text-red-200 text-xs font-semibold transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
                      >
                        <Trash2 className="h-4 w-4" /> Delete Space
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
