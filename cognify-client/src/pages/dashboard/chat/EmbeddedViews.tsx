import React, { useState, useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import {
  Activity,
  Coins,
  Clock,
  DollarSign,
  Users,
  FolderOpen,
  Plus,
  Trash2,
  CheckCircle,
  Copy,
  Check,
  CreditCard,
  Download,
  Bot,
  Terminal,
  ChevronRight,
  FileText,
  X,
  Loader2,
  Sparkles,
  Layers,
} from "lucide-react";
import { api } from "../../../utils/api";
import { Agents as AgentsView } from "../Agents";
import { Analytics as AnalyticsView } from "../Analytics";
import { Files } from "../Files";
import { Workflows } from "../Workflows";
import { Memory } from "../Memory";
import { Collaboration } from "../Collaboration";

export { AnalyticsView };

/* ─── Design tokens (Dark Monochrome Theme Aligned) ──────── */
const WT = {
  bg: "#000000",
  bgSubtle: "rgba(255, 255, 255, 0.03)",
  bgCard: "#09090b",
  bgHover: "rgba(255, 255, 255, 0.06)",
  border: "rgba(255, 255, 255, 0.1)",
  borderMd: "rgba(255, 255, 255, 0.2)",
  text0: "#ffffff",
  text1: "#a1a1aa",
  text2: "#71717a",
  text3: "#52525b",
  orange: "#ffffff",
  orangeDim: "rgba(255, 255, 255, 0.08)",
  orangeBorder: "rgba(255, 255, 255, 0.25)",
  green: "#10b981",
};

export const WorkspacesView: React.FC = () => {
  const [workspaces, setWorkspaces] = useState<any[]>([]);
  const [selectedWsId, setSelectedWsId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [files, setFiles] = useState<any[]>([]);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<"overview" | "files" | "workflows" | "memory" | "collaboration" | "members" | "settings">("overview");

  // Workspace creation modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newWsName, setNewWsName] = useState("");
  const [newWsDesc, setNewWsDesc] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  // Close modal on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && showCreateModal) {
        setShowCreateModal(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showCreateModal]);

  useEffect(() => {
    if (!selectedWsId) { setFiles([]); return; }
    api.get(`/files/${selectedWsId}`)
      .then((res) => setFiles(res.data.map((f: any) => ({
        id: f.id,
        filename: f.original_name || f.filename,
        size: `${(f.size / (1024 * 1024)).toFixed(2)} MB`,
      }))))
      .catch(() => setFiles([]));
  }, [selectedWsId]);

  useEffect(() => {
    api.get("/teams/my-teams")
      .then((res) => {
        if (res.data && res.data.length > 0) {
          setTeamMembers(res.data.map((tm: any) => ({
            id: tm.id,
            name: tm.team?.name || "Team Member",
            role: tm.role || "Viewer",
          })));
        } else {
          setTeamMembers([]);
        }
      })
      .catch(() => setTeamMembers([]));
  }, []);

  const fetchWorkspaces = async () => {
    try {
      setLoading(true);
      const res = await api.get("/workspaces");
      setWorkspaces(res.data);
      if (res.data.length > 0) {
        const saved = localStorage.getItem("activeWorkspaceId") || res.data[0].id;
        setSelectedWsId(saved);
      }
    } catch (err) {
      console.error("Failed to fetch workspaces", err);
      setWorkspaces([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchWorkspaces(); }, []);

  const selectedWs = workspaces.find((w) => w.id === selectedWsId);

  const selectedWsMembers = React.useMemo(() => {
    if (!selectedWs) return [];
    const collaboratorsMap = new Map<string, any>();
    
    // Owner
    if (selectedWs.user) {
      collaboratorsMap.set(selectedWs.user.id, {
        id: selectedWs.user.id,
        name: selectedWs.user.name || selectedWs.user.email.split("@")[0],
        email: selectedWs.user.email,
        role: "ADMIN",
        isOwner: true,
        initials: (selectedWs.user.name || "U").split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2),
      });
    }

    // Team members who have access
    selectedWs.team_workspaces?.forEach((tw: any) => {
      tw.team?.members?.forEach((m: any) => {
        if (m.user) {
          const u = m.user;
          if (!collaboratorsMap.has(u.id)) {
            collaboratorsMap.set(u.id, {
              id: m.id,
              name: u.name || u.email.split("@")[0],
              email: u.email,
              role: m.role || "VIEWER",
              isOwner: false,
              initials: (u.name || "U").split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2),
            });
          }
        }
      });
    });

    return Array.from(collaboratorsMap.values());
  }, [selectedWs]);

  const handleSwitchWorkspace = (id: string) => {
    setSelectedWsId(id);
    localStorage.setItem("activeWorkspaceId", id);
    window.dispatchEvent(new Event("activeWorkspaceIdChanged"));
    setActiveTab("overview");
  };

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWsName.trim() || isCreating) return;

    setIsCreating(true);
    try {
      const res = await api.post("/workspaces", {
        name: newWsName.trim(),
        description: newWsDesc.trim() || "Isolated logical workspace for AI agent workflows",
      });
      const newWs = res.data;
      setWorkspaces((prev) => [newWs, ...prev]);
      setSelectedWsId(newWs.id);
      localStorage.setItem("activeWorkspaceId", newWs.id);

      setNewWsName("");
      setNewWsDesc("");
      setShowCreateModal(false);

      // Trigger workspace layout refresh
      window.dispatchEvent(new Event("workspacesChanged"));
      window.dispatchEvent(new Event("activeWorkspaceIdChanged"));
    } catch (err: any) {
      alert(err.response?.data?.message || "Failed to create workspace");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        height: "100%",
        overflow: "hidden",
        background: WT.bg,
        fontFamily: "'Instrument Sans', 'Inter', system-ui, sans-serif",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600;700&family=Geist+Mono:wght@400;500;600&display=swap');
        .ws-scroll::-webkit-scrollbar { width: 4px; }
        .ws-scroll::-webkit-scrollbar-track { background: transparent; }
        .ws-scroll::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.1); border-radius: 2px; }
        
        @container (max-width: 900px) {
          .lg\\:grid-cols-4 {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }
          .lg\\:col-span-2 {
            grid-column: span 2 / span 2 !important;
          }
          .lg\\:col-span-1 {
            grid-column: span 1 / span 1 !important;
          }
        }
        @container (max-width: 680px) {
          .lg\\:grid-cols-4, .lg\\:grid-cols-3, .md\\:grid-cols-3 {
            grid-template-columns: 1fr !important;
          }
          .lg\\:col-span-2, .lg\\:col-span-3, .md\\:col-span-2, .lg\\:col-span-1 {
            grid-column: span 1 / span 1 !important;
          }
        }
      `}</style>

      {/* ── LEFT: Workspace list ── */}
      <div
        className="ws-scroll"
        style={{
          width: "300px",
          height: "100%",
          padding: "28px 24px",
          borderRight: `1px solid ${WT.border}`,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: 20,
          flexShrink: 0,
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 600, color: WT.text0, margin: 0, letterSpacing: "-0.01em" }}>
              Workspaces
            </h1>
            <p style={{ fontSize: 13, color: WT.text2, margin: "4px 0 0", lineHeight: 1.5 }}>
              Manage active platform segments.
            </p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "7px 14px",
              borderRadius: 8,
              border: "1px solid rgba(255, 255, 255, 0.15)",
              background: "#ffffff",
              fontSize: 12,
              fontWeight: 600,
              color: "#000000",
              cursor: "pointer",
              fontFamily: "inherit",
              boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
              transition: "all 120ms ease",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = "#e4e4e7";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = "#ffffff";
            }}
          >
            <Plus style={{ width: 13, height: 13, strokeWidth: 2.5 }} />
            Create
          </button>
        </div>

        {/* Workspace list */}
        {loading ? (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div
              style={{
                width: 22,
                height: 22,
                border: "2px solid rgba(255, 255, 255, 0.1)",
                borderTopColor: "#ffffff",
                borderRadius: "50%",
                animation: "spin 0.7s linear infinite",
              }}
            />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {workspaces.map((ws) => {
              const isSelected = selectedWsId === ws.id;
              return (
                <div
                  key={ws.id}
                  onClick={() => handleSwitchWorkspace(ws.id)}
                  style={{
                    position: "relative",
                    overflow: "hidden",
                    padding: "13px 14px 13px 16px",
                    borderRadius: 10,
                    border: isSelected ? "1px solid rgba(255, 255, 255, 0.28)" : "1px solid rgba(255, 255, 255, 0.08)",
                    background: isSelected ? "rgba(255, 255, 255, 0.06)" : "rgba(255, 255, 255, 0.02)",
                    boxShadow: isSelected ? "0 2px 8px rgba(0,0,0,0.35), inset 0 0 0 1px rgba(255, 255, 255, 0.05)" : "none",
                    cursor: "pointer",
                    transition: "border-color 140ms ease, background 140ms ease, box-shadow 140ms ease",
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) {
                      (e.currentTarget as HTMLElement).style.background = "rgba(255, 255, 255, 0.04)";
                      (e.currentTarget as HTMLElement).style.borderColor = "rgba(255, 255, 255, 0.16)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) {
                      (e.currentTarget as HTMLElement).style.background = "rgba(255, 255, 255, 0.02)";
                      (e.currentTarget as HTMLElement).style.borderColor = "rgba(255, 255, 255, 0.08)";
                    }
                  }}
                >
                  {/* Clean inner active left indicator pill (doesn't distort the rounded border) */}
                  {isSelected && (
                    <div
                      style={{
                        position: "absolute",
                        left: 0,
                        top: 10,
                        bottom: 10,
                        width: 3,
                        borderRadius: "0 2px 2px 0",
                        background: "#ffffff",
                      }}
                    />
                  )}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                    <p style={{ fontSize: 13.5, fontWeight: 600, color: "#ffffff", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {ws.name}
                    </p>
                    {isSelected && (
                      <span style={{ fontSize: 9, fontFamily: "monospace", padding: "1px 5px", borderRadius: 4, background: "rgba(255, 255, 255, 0.08)", color: "#ffffff", border: "1px solid rgba(255, 255, 255, 0.15)", letterSpacing: "0.04em", flexShrink: 0 }}>
                        ACTIVE
                      </span>
                    )}
                  </div>
                  <p style={{ fontSize: 12, color: "#a1a1aa", margin: "4px 0 0", lineHeight: 1.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {ws.description || "No description provided"}
                  </p>
                  <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 10, fontSize: 11, color: "#71717a" }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <Users style={{ width: 11, height: 11 }} />
                      {ws.membersCount || 0} members
                    </span>
                    <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <FolderOpen style={{ width: 11, height: 11 }} />
                      {ws.filesCount || 0} files
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── RIGHT: Workspace detail ── */}
      <div
        style={{
          flex: 1,
          height: "100%",
          padding: "28px 24px",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          gap: 0,
          containerType: "inline-size",
        }}
      >
        {selectedWs ? (
          <>
            {/* Workspace hero */}
            <div style={{ marginBottom: 20 }}>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 650,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  color: "#a1a1aa",
                  fontFamily: "Geist Mono, monospace",
                }}
              >
                Active Workspace
              </span>
              <h2
                style={{
                  fontSize: 24,
                  fontWeight: 700,
                  color: "#ffffff",
                  margin: "6px 0 0",
                  letterSpacing: "-0.02em",
                  lineHeight: 1.1,
                }}
              >
                {selectedWs.name}
              </h2>
              <p style={{ fontSize: 13, color: "#a1a1aa", lineHeight: 1.6, margin: "8px 0 0" }}>
                {selectedWs.description || "No description provided."}
              </p>
            </div>

            {/* Notion-style Tab Navigation (Horizontal) */}
            <div
              style={{
                display: "flex",
                borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
                marginBottom: 20,
                overflowX: "auto",
                whiteSpace: "nowrap",
                gap: 8,
                position: "relative",
                zIndex: 10,
                backgroundColor: "#000000",
              }}
              className="scrollbar-none"
            >
              {[
                { id: "overview", label: "Overview" },
                { id: "files", label: "Files" },
                { id: "workflows", label: "Workflows" },
                { id: "memory", label: "Memory" },
                { id: "collaboration", label: "Collaboration" },
                { id: "members", label: "Members" },
                { id: "settings", label: "Settings" },
              ].map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    style={{
                      padding: "10px 14px",
                      border: "none",
                      borderBottom: `2px solid ${isActive ? "#ffffff" : "transparent"}`,
                      background: "transparent",
                      fontSize: 12.5,
                      fontWeight: isActive ? 600 : 500,
                      color: isActive ? "#ffffff" : "#a1a1aa",
                      cursor: "pointer",
                      fontFamily: "inherit",
                      transition: "all 120ms",
                    }}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* Tab content area */}
            <div 
              className="ws-scroll" 
              style={{ 
                flex: 1, 
                display: "flex", 
                flexDirection: "column", 
                overflowY: "auto", 
                position: "relative" 
              }}
            >
              {activeTab === "overview" && (
                <>
                  {/* Stats row */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 12, marginBottom: 24 }}>
                    {[
                      { label: "Members", value: selectedWs.membersCount || 0, icon: <Users style={{ width: 13, height: 13 }} /> },
                      { label: "Files", value: selectedWs.filesCount || 0, icon: <FolderOpen style={{ width: 13, height: 13 }} /> },
                      { label: "Active Agents", value: "5", icon: <Bot style={{ width: 13, height: 13 }} /> },
                      { label: "Workflows", value: "3", icon: <Activity style={{ width: 13, height: 13 }} /> },
                    ].map((s) => (
                      <div
                        key={s.label}
                        style={{
                          padding: "12px 14px",
                          borderRadius: 10,
                          border: "1px solid rgba(255, 255, 255, 0.1)",
                          background: "#09090b",
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                        }}
                      >
                        <span style={{ color: "#a1a1aa" }}>{s.icon}</span>
                        <div>
                          <div style={{ fontSize: 18, fontWeight: 700, color: "#ffffff", fontFamily: "Geist Mono, monospace", lineHeight: 1 }}>
                            {s.value}
                          </div>
                          <div style={{ fontSize: 10, color: "#a1a1aa", marginTop: 4, fontFamily: "Geist Mono, monospace", textTransform: "uppercase" }}>{s.label}</div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Divider */}
                  <div style={{ height: 1, background: "rgba(255, 255, 255, 0.1)", marginBottom: 24 }} />

                  {/* Context files section */}
                  <div style={{ marginBottom: 24 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 650,
                          textTransform: "uppercase",
                          letterSpacing: "0.08em",
                          color: "#a1a1aa",
                          fontFamily: "Geist Mono, monospace",
                        }}
                      >
                        Context Files
                      </span>
                      <button
                        onClick={() => setActiveTab("files")}
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          color: "#ffffff",
                          background: "transparent",
                          border: "none",
                          cursor: "pointer",
                          textDecoration: "underline",
                        }}
                      >
                        Manage Files
                      </button>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {files.length > 0 ? (
                        files.slice(0, 5).map((f) => (
                          <div
                            key={f.id}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              padding: "10px 14px",
                              borderRadius: 8,
                              border: "1px solid rgba(255, 255, 255, 0.08)",
                              background: "#09090b",
                              transition: "border-color 120ms, background 120ms",
                            }}
                          >
                            <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                              <FileText style={{ width: 14, height: 14, color: "#a1a1aa" }} />
                              <span style={{ fontSize: 13, color: "#ffffff", fontWeight: 500 }}>{f.filename}</span>
                            </div>
                            <span style={{ fontSize: 11, color: "#71717a", fontFamily: "Geist Mono, monospace" }}>{f.size}</span>
                          </div>
                        ))
                      ) : (
                        <div style={{ padding: "14px 16px", borderRadius: 8, border: "1px solid rgba(255, 255, 255, 0.06)", background: "rgba(255, 255, 255, 0.02)", color: "#71717a", fontSize: 12, fontStyle: "italic" }}>
                          No files in this workspace.
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Divider */}
                  <div style={{ height: 1, background: "rgba(255, 255, 255, 0.1)", marginBottom: 24 }} />

                  {/* Team access section */}
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 650,
                          textTransform: "uppercase",
                          letterSpacing: "0.08em",
                          color: "#a1a1aa",
                          fontFamily: "Geist Mono, monospace",
                        }}
                      >
                        Team Access
                      </span>
                      <button
                        onClick={() => setActiveTab("collaboration")}
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          color: "#ffffff",
                          background: "transparent",
                          border: "none",
                          cursor: "pointer",
                          textDecoration: "underline",
                        }}
                      >
                        Manage Teams
                      </button>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {selectedWsMembers.length > 0 ? (
                        selectedWsMembers.slice(0, 5).map((m) => (
                          <div
                            key={m.id}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              padding: "10px 14px",
                              borderRadius: 8,
                              border: "1px solid rgba(255, 255, 255, 0.08)",
                              background: "#09090b",
                            }}
                          >
                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                              <div
                                style={{
                                  width: 28,
                                  height: 28,
                                  borderRadius: "50%",
                                  background: "rgba(255, 255, 255, 0.08)",
                                  border: "1px solid rgba(255, 255, 255, 0.2)",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  fontSize: 10,
                                  fontWeight: 700,
                                  color: "#ffffff",
                                  flexShrink: 0,
                                  fontFamily: "Geist Mono, monospace",
                                }}
                              >
                                {m.initials}
                              </div>
                              <div>
                                <div style={{ fontSize: 13, fontWeight: 500, color: "#ffffff" }}>{m.name} {m.isOwner && "(Owner)"}</div>
                                <div style={{ fontSize: 11, color: "#71717a", marginTop: 1 }}>{m.role}</div>
                              </div>
                            </div>
                            <span style={{ fontSize: 10, fontFamily: "Geist Mono, monospace", padding: "2px 8px", borderRadius: 4, background: "rgba(255, 255, 255, 0.08)", border: "1px solid rgba(255, 255, 255, 0.15)", color: "#d4d4d8" }}>
                              {m.role}
                            </span>
                          </div>
                        ))
                      ) : (
                        <p style={{ fontSize: 13, color: WT.text2, fontStyle: "italic", margin: 0, padding: "8px 0" }}>
                          No team members.
                        </p>
                      )}
                    </div>
                  </div>
                </>
              )}

              {activeTab === "files" && <Files />}
              {activeTab === "workflows" && <Workflows />}
              {activeTab === "memory" && <Memory />}
              {activeTab === "collaboration" && <Collaboration />}
              
              {activeTab === "members" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `1px solid ${WT.border}`, paddingBottom: 8 }}>
                    <h3 style={{ fontSize: 14, fontWeight: 600, color: WT.text0, margin: 0 }}>Collaborator List</h3>
                    <button
                      onClick={() => setActiveTab("collaboration")}
                      style={{
                        padding: "6px 12px",
                        borderRadius: 8,
                        border: "1px solid rgba(255, 255, 255, 0.15)",
                        background: "rgba(255, 255, 255, 0.08)",
                        color: "#ffffff",
                        fontSize: 11,
                        fontWeight: 600,
                        cursor: "pointer",
                        fontFamily: "inherit"
                      }}
                    >
                      Manage Teams & Sharing
                    </button>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {(() => {
                      const collaboratorsMap = new Map<string, any>();
                      
                      // Owner
                      if (selectedWs.user) {
                        collaboratorsMap.set(selectedWs.user.id, {
                          id: selectedWs.user.id,
                          name: selectedWs.user.name || "Workspace Owner",
                          email: selectedWs.user.email,
                          role: "OWNER"
                        });
                      }

                      // Team members who have access
                      selectedWs.team_workspaces?.forEach((tw: any) => {
                        tw.team?.members?.forEach((m: any) => {
                          if (m.user) {
                            collaboratorsMap.set(m.user.id, {
                              id: m.user.id,
                              name: m.user.name,
                              email: m.user.email,
                              role: m.role
                            });
                          }
                        });
                      });

                      const list = Array.from(collaboratorsMap.values());
                      if (list.length === 0) {
                        return <div style={{ textAlign: "center", color: WT.text2, fontSize: 12, fontStyle: "italic", padding: "12px 0" }}>No collaborator profiles found.</div>;
                      }

                      return list.map((member) => (
                        <div
                          key={member.id}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            padding: "10px 14px",
                            borderRadius: 8,
                            border: `1px solid ${WT.border}`,
                            background: WT.bgSubtle
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <div style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(255, 255, 255, 0.08)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "#ffffff", border: "1px solid rgba(255, 255, 255, 0.15)", flexShrink: 0, fontFamily: "Geist Mono, monospace" }}>
                              {(member.name || "U")[0].toUpperCase()}
                            </div>
                            <div style={{ display: "flex", flexDirection: "column" }}>
                              <span style={{ fontSize: 12, fontWeight: 600, color: WT.text0 }}>{member.name}</span>
                              <span style={{ fontSize: 10, color: WT.text2 }}>{member.email}</span>
                            </div>
                          </div>
                          <span style={{
                            fontSize: 10,
                            fontFamily: "Geist Mono, monospace",
                            padding: "2px 8px",
                            borderRadius: 4,
                            textTransform: "uppercase",
                            background: "rgba(255, 255, 255, 0.08)",
                            color: "#d4d4d8",
                            border: "1px solid rgba(255, 255, 255, 0.15)"
                          }}>
                            {member.role}
                          </span>
                        </div>
                      ));
                    })()}
                  </div>
                </div>
              )}

              {activeTab === "settings" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                  <div>
                    <h3 style={{ fontSize: 14, fontWeight: 600, color: WT.text0, margin: 0 }}>Security and Directory Access</h3>
                    <p style={{ fontSize: 12, color: WT.text2, margin: "4px 0 0" }}>Adjust accessibility permissions for the {selectedWs.name} hub.</p>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                    <div style={{ padding: 14, borderRadius: 8, border: `1px solid ${WT.border}`, background: WT.bgSubtle, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <p style={{ fontSize: 12, fontWeight: 600, color: WT.text0, margin: 0 }}>Public Discoverability</p>
                        <p style={{ fontSize: 10, color: WT.text2, margin: "2px 0 0" }}>Make workspace searchable.</p>
                      </div>
                      <button style={{ width: 36, height: 20, borderRadius: 10, background: "rgba(255, 255, 255, 0.1)", border: "1px solid rgba(255, 255, 255, 0.15)", position: "relative" }}>
                        <span style={{ width: 14, height: 14, borderRadius: "50%", background: "#71717a", display: "block", position: "absolute", left: 2, top: 2 }}></span>
                      </button>
                    </div>
                    <div style={{ padding: 14, borderRadius: 8, border: `1px solid ${WT.border}`, background: WT.bgSubtle, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <p style={{ fontSize: 12, fontWeight: 600, color: WT.text0, margin: 0 }}>Isolated Sandbox</p>
                        <p style={{ fontSize: 10, color: WT.text2, margin: "2px 0 0" }}>Isolate execution memory.</p>
                      </div>
                      <button style={{ width: 36, height: 20, borderRadius: 10, background: "rgba(255, 255, 255, 0.25)", border: "1px solid rgba(255, 255, 255, 0.2)", position: "relative" }}>
                        <span style={{ width: 14, height: 14, borderRadius: "50%", background: "#ffffff", display: "block", position: "absolute", right: 2, top: 2 }}></span>
                      </button>
                    </div>
                  </div>
                  <div style={{ borderTop: `1px solid ${WT.border}`, paddingTop: 20 }}>
                    <h4 style={{ fontSize: 12, fontWeight: 700, color: "#f87171", margin: 0, textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: "Geist Mono, monospace" }}>Danger Zone</h4>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: 14, borderRadius: 8, border: "1px solid rgba(127, 29, 29, 0.4)", background: "rgba(127, 29, 29, 0.1)", marginTop: 12 }}>
                      <div>
                        <p style={{ fontSize: 12, fontWeight: 600, color: "#fca5a5", margin: 0 }}>Delete Workspace</p>
                        <p style={{ fontSize: 10, color: WT.text2, margin: "2px 0 0" }}>Permanently purge database links and configs.</p>
                      </div>
                      <button
                        onClick={async () => {
                          if (confirm("Are you sure you want to delete this workspace?")) {
                            try {
                              await api.delete(`/workspaces/${selectedWs.id}`);
                              localStorage.removeItem("activeWorkspaceId");
                              window.dispatchEvent(new Event("workspacesChanged"));
                              window.dispatchEvent(new Event("activeWorkspaceIdChanged"));
                            } catch (err: any) {
                              alert(err.response?.data?.message || "Failed to delete workspace");
                            }
                          }
                        }}
                        style={{ padding: "8px 14px", borderRadius: 8, background: "#ef4444", border: "none", color: "#ffffff", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
                      >
                        Delete Space
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <div
            style={{
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 13,
              color: WT.text3,
              fontStyle: "italic",
            }}
          >
            Select a workspace to view its details.
          </div>
        )}
      </div>

      {/* ─── ANIMATED CREATE WORKSPACE MODAL (SAAS UI STYLE) ────────────────── */}
      <AnimatePresence>
        {showCreateModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto"
            onClick={(e) => {
              if (e.target === e.currentTarget) setShowCreateModal(false);
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 14 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 14 }}
              transition={{ type: "spring", damping: 28, stiffness: 380 }}
              className="w-full max-w-md rounded-2xl bg-zinc-950 border border-white/10 shadow-2xl p-6 relative overflow-hidden flex flex-col gap-5 text-left my-8"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Top ambient hairline glow */}
              <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
              <div className="absolute -top-24 -right-24 w-48 h-48 bg-white/[0.03] rounded-full blur-3xl pointer-events-none" />

              {/* Header */}
              <div>
                <div className="flex items-center justify-between">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono tracking-wider uppercase border border-white/10 bg-white/5 text-zinc-300">
                    <Layers className="h-3 w-3 text-white" />
                    Workspace Ecosystem
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="h-7 w-7 rounded-lg flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 border border-transparent hover:border-white/10 transition-all cursor-pointer"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <h2 className="text-xl font-bold text-white tracking-tight mt-2.5">
                  Create New Workspace
                </h2>
                <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                  Initialize an isolated logical namespace to organize AI agents, prompts, files, and credit pools.
                </p>
              </div>

              {/* Form */}
              <form onSubmit={handleCreateWorkspace} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-mono font-semibold uppercase tracking-wider text-zinc-400">
                    Workspace Identifier <span className="text-zinc-500">*</span>
                  </label>
                  <input
                    autoFocus
                    type="text"
                    required
                    placeholder="e.g. Legal Research Mesh"
                    value={newWsName}
                    onChange={(e) => setNewWsName(e.target.value)}
                    className="w-full bg-zinc-900/90 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-white/30 focus:ring-1 focus:ring-white/20 transition-all font-sans"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-mono font-semibold uppercase tracking-wider text-zinc-400">
                    Description <span className="text-zinc-500 font-normal">(Optional)</span>
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Classify user queries, query vector embeddings, and coordinate actions..."
                    value={newWsDesc}
                    onChange={(e) => setNewWsDesc(e.target.value)}
                    className="w-full bg-zinc-900/90 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-white/30 transition-all font-sans resize-none"
                  />
                </div>

                {/* Footer Buttons */}
                <div className="flex items-center justify-between pt-3 mt-2 border-t border-white/10">
                  <span className="text-[11px] font-mono text-zinc-500 hidden sm:inline-block">
                    Press <kbd className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-zinc-400 text-[10px]">Esc</kbd> to dismiss
                  </span>
                  <div className="flex items-center gap-2.5 ml-auto">
                    <button
                      type="button"
                      onClick={() => setShowCreateModal(false)}
                      className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-400 hover:text-white bg-transparent hover:bg-white/5 border border-white/10 transition-all cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isCreating || !newWsName.trim()}
                      className="px-5 py-2 rounded-xl text-xs font-semibold bg-white text-black hover:bg-zinc-200 disabled:opacity-40 transition-all flex items-center gap-1.5 cursor-pointer shadow-sm font-medium"
                    >
                      {isCreating ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          Creating...
                        </>
                      ) : (
                        <>
                          <Plus className="h-3.5 w-3.5" />
                          Create Space →
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};


/* ─────────────────────────────────────────────
   AGENTS VIEW
───────────────────────────────────────────── */
export { AgentsView };

/* ─────────────────────────────────────────────
   BILLING VIEW
───────────────────────────────────────────── */
export const BillingView: React.FC = () => {
  const invoices = [
    { date: "May 12, 2026", desc: "Cognify Pro Plan Renewal", amount: "$79.00", status: "Paid" },
    { date: "Apr 12, 2026", desc: "Cognify Pro Plan Renewal", amount: "$79.00", status: "Paid" },
    { date: "Mar 12, 2026", desc: "Cognify Pro Plan (Initial)", amount: "$79.00", status: "Paid" },
  ];

  return (
    <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6" style={{ background: "#1a1a1a" }}>
      <div>
        <h1 className="text-xl font-medium text-white tracking-tight">Billing & Subscriptions</h1>
        <p className="text-xs text-[#555] mt-1">Configure plan tiers, payment details, and check invoices.</p>
      </div>

      {/* Plan selector cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {[
          { name: "Free Tier", desc: "Perfect for lightweight prompt testing and local sandboxes.", cost: "$0", active: true },
          { name: "Pro Plan", desc: "Full workflow executions, advanced RAG vectors, and Slack hooks.", cost: "$79/mo", active: false },
          { name: "Enterprise Custom", desc: "Dedicated instance nodes, custom models, and cluster isolation.", cost: "Custom", active: false },
        ].map((plan, i) => (
          <div
            key={i}
            className="p-5 rounded-xl border flex flex-col justify-between"
            style={{
              backgroundColor: plan.active ? "#09090b" : "#121215",
              borderColor: plan.active ? "rgba(255, 255, 255, 0.3)" : "rgba(255, 255, 255, 0.1)",
              borderWidth: "1px",
            }}
          >
            <div>
              <div className="flex justify-between items-center select-none">
                <span className="text-sm font-semibold text-white">{plan.name}</span>
                {plan.active && (
                  <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-white bg-white/10 border border-white/20 px-2 py-0.5 rounded">
                    Active Plan
                  </span>
                )}
              </div>
              <p className="text-xs text-zinc-400 mt-2 leading-relaxed">{plan.desc}</p>
            </div>
            <div className="mt-5 flex items-end justify-between select-none">
              <span className="text-xl font-bold text-white leading-none font-mono">{plan.cost}</span>
              {!plan.active && (
                <button 
                  className="px-3 py-1.5 rounded-lg border border-zinc-700 text-[10px] font-semibold text-white hover:border-white transition-colors cursor-pointer bg-transparent"
                >
                  Upgrade
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Payment History */}
      <div className="flex flex-col gap-3">
        <h3 className="text-xs font-mono font-semibold text-zinc-400 uppercase tracking-wider select-none">Payment Invoices</h3>
        
        <div 
          className="rounded-xl border border-white/10 bg-zinc-950/80 overflow-hidden"
        >
          <div className="grid grid-cols-4 p-3.5 text-[10px] text-zinc-400 uppercase font-mono border-b border-white/10 bg-black/60">
            <span>Date</span>
            <span>Description</span>
            <span>Amount</span>
            <span className="text-right">Action</span>
          </div>
          <div className="flex flex-col">
            {invoices.map((inv, i) => (
              <div 
                key={i} 
                className="grid grid-cols-4 p-3.5 text-xs text-zinc-300 border-b border-white/5 last:border-none hover:bg-zinc-900/40 transition-colors"
              >
                <span className="font-mono text-zinc-400">{inv.date}</span>
                <span className="text-white font-medium">{inv.desc}</span>
                <span className="text-emerald-400 font-mono">{inv.amount}</span>
                <div className="flex justify-end">
                  <button className="p-1 rounded text-zinc-400 hover:text-white cursor-pointer bg-transparent border-none">
                    <Download className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
