import React, { useState, useEffect, useMemo } from "react";
import { 
  Plus, 
  Search, 
  Link as LinkIcon, 
  Trash2, 
  Edit2, 
  ExternalLink, 
  CheckCircle, 
  Circle, 
  Calendar, 
  RefreshCw, 
  Download, 
  Upload, 
  Layout, 
  Settings,
  Bell,
  LogOut,
  ChevronRight,
  GripVertical,
  LogOut as LogOutIcon,
  LogIn,
  Zap
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, isPast, isWithinInterval, addDays, startOfToday } from "date-fns";
import { 
  onSnapshot, 
  collection, 
  query, 
  where, 
  orderBy, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  serverTimestamp,
  setDoc,
  Timestamp
} from "firebase/firestore";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";

import { auth, db, signInWithGoogle, OperationType, handleFirestoreError } from "./lib/firebase";
import { Group, Task, FilterType } from "./types";
import { normalizeUrl, getReadableUrl, extractAndSaveVariables, replaceVariables } from "./lib/utils";
import Landing from "./components/layout/Landing";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function App() {
  const [isGuest, setIsGuest] = useState(() => localStorage.getItem("dailylink_is_guest") === "true");
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"landing" | "app">(() => {
    return localStorage.getItem("dailylink_is_guest") === "true" ? "app" : "landing";
  });
  const [authError, setAuthError] = useState<string | null>(null);
  
  const [groups, setGroups] = useState<Group[]>(() => {
    const isG = localStorage.getItem("dailylink_is_guest") === "true";
    if (isG) {
      const stored = localStorage.getItem("dailylink_guest_groups");
      return stored ? JSON.parse(stored) : [];
    }
    return [];
  });
  const [activeGroupId, setActiveGroupId] = useState<string | null>(() => {
    const isG = localStorage.getItem("dailylink_is_guest") === "true";
    if (isG) {
      return localStorage.getItem("dailylink_guest_active_group_id");
    }
    return null;
  });
  const [tasks, setTasks] = useState<Task[]>(() => {
    const isG = localStorage.getItem("dailylink_is_guest") === "true";
    if (isG) {
      const stored = localStorage.getItem("dailylink_guest_tasks");
      return stored ? JSON.parse(stored) : [];
    }
    return [];
  });
  
  // Modals
  const [showAddGroup, setShowAddGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [taskToDelete, setTaskToDelete] = useState<string | null>(null);
  const [isDeletingGroup, setIsDeletingGroup] = useState<string | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  
  const [filter, setFilter] = useState<FilterType>("all");
  const [search, setSearch] = useState("");
  const [gasPrice, setGasPrice] = useState<number | null>(null);

  // Auth State
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
      if (u) {
        setIsGuest(false);
        localStorage.removeItem("dailylink_is_guest");
        setView("app");
        setAuthError(null);
      } else {
        if (localStorage.getItem("dailylink_is_guest") !== "true") {
          setGroups([]);
          setTasks([]);
          setActiveGroupId(null);
        }
      }
    });
    return () => unsubscribe();
  }, []);

  const handleSignIn = async () => {
    setAuthError(null);
    try {
      await signInWithGoogle();
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : "Authentication failed. Please try again.");
    }
  };

  // Gas Price
  useEffect(() => {
    const fetchGas = async () => {
      try {
        const res = await fetch("/api/gas");
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        const data = await res.json();
        if (data.result?.ProposeGasPrice) {
          setGasPrice(Number(data.result.ProposeGasPrice));
        }
      } catch (err) {
        // Log locally but don't crash or show user-facing error for this non-critical feature
        console.warn("Gas info temporarily unavailable", err);
      }
    };
    fetchGas();
    const interval = setInterval(fetchGas, 60000); // Check every minute instead of 30s
    return () => clearInterval(interval);
  }, []);

  // Guest mode initial load
  useEffect(() => {
    if (isGuest) {
      const storedGroups = localStorage.getItem("dailylink_guest_groups");
      const storedTasks = localStorage.getItem("dailylink_guest_tasks");
      const loadedGroups = storedGroups ? JSON.parse(storedGroups) : [];
      const loadedTasks = storedTasks ? JSON.parse(storedTasks) : [];
      setGroups(loadedGroups);
      setTasks(loadedTasks);
      setLoading(false);

      const storedActiveGroup = localStorage.getItem("dailylink_guest_active_group_id");
      if (storedActiveGroup) {
        setActiveGroupId(storedActiveGroup);
      } else if (loadedGroups.length > 0) {
        setActiveGroupId(loadedGroups[0].id);
      }
    }
  }, [isGuest]);

  // Sync to local storage whenever groups/tasks change in guest mode
  useEffect(() => {
    if (isGuest) {
      localStorage.setItem("dailylink_guest_groups", JSON.stringify(groups));
    }
  }, [groups, isGuest]);

  useEffect(() => {
    if (isGuest) {
      localStorage.setItem("dailylink_guest_tasks", JSON.stringify(tasks));
    }
  }, [tasks, isGuest]);

  useEffect(() => {
    if (isGuest && activeGroupId) {
      localStorage.setItem("dailylink_guest_active_group_id", activeGroupId);
    }
  }, [activeGroupId, isGuest]);

  // Daily task auto-reset effect (runs once today starts/page reloads)
  useEffect(() => {
    if (tasks.length === 0) return;
    const today = startOfToday();
    
    const resetOutstandingTasks = async () => {
      let changed = false;
      const updatedTasks = tasks.map(task => {
        if (task.completed && task.completedAt) {
          const group = groups.find(g => g.id === task.groupId);
          if (group?.dailyReset) {
            // Check representation
            const compDate = (task.completedAt as any).toDate 
              ? (task.completedAt as any).toDate() 
              : new Date(task.completedAt as any);
              
            if (compDate < today) {
              changed = true;
              return {
                ...task,
                completed: false,
                completedAt: undefined,
                updatedAt: isGuest ? Date.now() : (serverTimestamp() as any)
              };
            }
          }
        }
        return task;
      });

      if (changed) {
        if (isGuest) {
          setTasks(updatedTasks);
        } else {
          // Sync online updates securely
          for (const task of tasks) {
            if (task.completed && task.completedAt) {
              const group = groups.find(g => g.id === task.groupId);
              if (group?.dailyReset) {
                const compDate = (task.completedAt as any).toDate 
                  ? (task.completedAt as any).toDate() 
                  : new Date(task.completedAt as any);
                  
                if (compDate < today) {
                  try {
                    await updateDoc(doc(db, "tasks", task.id), {
                      completed: false,
                      completedAt: null,
                      updatedAt: serverTimestamp(),
                    });
                  } catch (e) {
                    console.error("Failed to reset database task auto-increment, error: ", e);
                  }
                }
              }
            }
          }
        }
      }
    };
    
    resetOutstandingTasks();
  }, [tasks, groups, isGuest]);

  // Groups Listener (Active only when Online)
  useEffect(() => {
    if (!user || isGuest) return;
    const q = query(
      collection(db, "groups"), 
      where("userId", "==", user.uid),
      orderBy("createdAt", "desc")
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const gList = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Group));
      setGroups(gList);
      if (!activeGroupId && gList.length > 0) {
        setActiveGroupId(gList[0].id);
      }
    }, (err) => handleFirestoreError(err, OperationType.LIST, "groups"));
    
    return () => unsubscribe();
  }, [user, isGuest]);

  // Tasks Listener (Active only when Online)
  useEffect(() => {
    if (!user || isGuest) return;
    const q = query(
      collection(db, "tasks"), 
      where("userId", "==", user.uid),
      orderBy("order", "asc")
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const tList = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Task));
      setTasks(tList);
    }, (err) => handleFirestoreError(err, OperationType.LIST, "tasks"));
    
    return () => unsubscribe();
  }, [user, isGuest]);

  // --- Handlers ---
  const toggleDailyReset = async () => {
    if (!activeGroup) return;
    try {
      if (isGuest) {
        setGroups(prev => prev.map(g => g.id === activeGroupId ? {
          ...g,
          dailyReset: !g.dailyReset,
          updatedAt: Date.now()
        } : g));
      } else {
        await updateDoc(doc(db, "groups", activeGroup.id), {
          dailyReset: !activeGroup.dailyReset,
          updatedAt: serverTimestamp(),
        });
      }
    } catch (err) {
      if (!isGuest) {
        handleFirestoreError(err, OperationType.UPDATE, `groups/${activeGroup.id}`);
      }
    }
  };

  const handleAddGroup = async () => {
    if (!newGroupName.trim() || (!user && !isGuest)) return;
    setModalError(null);
    try {
      if (isGuest) {
        const newGroupObj: Group = {
          id: "g_" + Date.now().toString(),
          name: newGroupName.trim().toUpperCase(),
          userId: "guest",
          dailyReset: true,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        setGroups(prev => [newGroupObj, ...prev]);
        setActiveGroupId(newGroupObj.id);
        setNewGroupName("");
        setShowAddGroup(false);
      } else {
        await addDoc(collection(db, "groups"), {
          name: newGroupName.trim().toUpperCase(),
          userId: user!.uid,
          dailyReset: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        setNewGroupName("");
        setShowAddGroup(false);
      }
      setModalError(null);
    } catch (err: any) {
      console.error("Group creation failed:", err);
      let msg = "Could not create group.";
      if (err instanceof Error) {
        msg = err.message;
        try {
          const parsed = JSON.parse(err.message);
          if (parsed && parsed.error) {
            msg = parsed.error;
          }
        } catch (_) {}
      }
      setModalError(msg);
    }
  };

  const handleAddUrl = async (urlInput: string) => {
    if (!urlInput || (!user && !isGuest) || !activeGroupId) return;
    
    const normalized = normalizeUrl(urlInput);
    const withVariables = extractAndSaveVariables(normalized);
    
    try {
      // Get metadata from our server API
      const metaRes = await fetch(`/api/metadata?url=${encodeURIComponent(replaceVariables(withVariables))}`);
      const meta = await metaRes.json();
      
      const newOrder = tasks.filter(t => t.groupId === activeGroupId).length;
      
      if (isGuest) {
        const newTaskObj: Task = {
          id: "t_" + Date.now().toString(),
          url: withVariables,
          title: meta.title || getReadableUrl(withVariables),
          favicon: meta.favicon || `https://www.google.com/s2/favicons?domain=${new URL(replaceVariables(withVariables)).hostname}&sz=64`,
          notes: "",
          completed: false,
          resetDaily: true,
          order: newOrder,
          userId: "guest",
          groupId: activeGroupId,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        setTasks(prev => [...prev, newTaskObj]);
      } else {
        await addDoc(collection(db, "tasks"), {
          url: withVariables,
          title: meta.title || getReadableUrl(withVariables),
          favicon: meta.favicon || `https://www.google.com/s2/favicons?domain=${new URL(replaceVariables(withVariables)).hostname}&sz=64`,
          notes: "",
          completed: false,
          resetDaily: true,
          order: newOrder,
          userId: user!.uid,
          groupId: activeGroupId,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
    } catch (err) {
      if (!isGuest) {
        handleFirestoreError(err, OperationType.CREATE, "tasks");
      } else {
        console.error("Task creation failed:", err);
      }
    }
  };

  const toggleTask = async (task: Task) => {
    try {
      if (isGuest) {
        setTasks(prev => prev.map(t => t.id === task.id ? {
          ...t,
          completed: !t.completed,
          completedAt: !t.completed ? Date.now() : undefined,
          updatedAt: Date.now()
        } : t));
      } else {
        await updateDoc(doc(db, "tasks", task.id), {
          completed: !task.completed,
          completedAt: !task.completed ? serverTimestamp() : null,
          updatedAt: serverTimestamp(),
        });
      }
    } catch (err) {
      if (!isGuest) {
        handleFirestoreError(err, OperationType.UPDATE, `tasks/${task.id}`);
      } else {
        console.error("Failed to toggle task:", err);
      }
    }
  };

  const deleteTask = async (taskId: string) => {
    try {
      if (isGuest) {
        setTasks(prev => prev.filter(t => t.id !== taskId));
        setTaskToDelete(null);
      } else {
        await deleteDoc(doc(db, "tasks", taskId));
        setTaskToDelete(null);
      }
    } catch (err) {
      if (!isGuest) {
        handleFirestoreError(err, OperationType.DELETE, `tasks/${taskId}`);
      } else {
        console.error("Failed to delete task:", err);
      }
    }
  };

  const deleteGroup = async (groupId: string) => {
    try {
      if (isGuest) {
        setGroups(prev => prev.filter(g => g.id !== groupId));
        setTasks(prev => prev.filter(t => t.groupId !== groupId));
        if (activeGroupId === groupId) {
          setActiveGroupId(groups.find(g => g.id !== groupId)?.id || null);
        }
        setIsDeletingGroup(null);
      } else {
        await deleteDoc(doc(db, "groups", groupId));
        // Also delete tasks for this group
        const groupTasks = tasks.filter(t => t.groupId === groupId);
        for (const t of groupTasks) {
          await deleteDoc(doc(db, "tasks", t.id));
        }
        if (activeGroupId === groupId) {
          setActiveGroupId(groups.find(g => g.id !== groupId)?.id || null);
        }
        setIsDeletingGroup(null);
      }
    } catch (err) {
      if (!isGuest) {
        handleFirestoreError(err, OperationType.DELETE, `groups/${groupId}`);
      } else {
        console.error("Failed to delete group:", err);
      }
    }
  };

  const openAllActive = () => {
    const activeTasks = tasks.filter(t => t.groupId === activeGroupId && !t.completed);
    activeTasks.forEach(t => {
      window.open(replaceVariables(t.url), "_blank");
    });
  };

  // --- Derived ---
  const activeGroup = groups.find(g => g.id === activeGroupId);
  const filteredTasks = tasks.filter(t => {
    if (t.groupId !== activeGroupId) return false;
    const matchesSearch = t.title.toLowerCase().includes(search.toLowerCase()) || 
                          t.url.toLowerCase().includes(search.toLowerCase());
    if (!matchesSearch) return false;
    
    if (filter === "active") return !t.completed;
    if (filter === "completed") return t.completed;
    // Add logic for due/expired if needed
    return true;
  });

  const progress = useMemo(() => {
    const groupTasks = tasks.filter(t => t.groupId === activeGroupId);
    if (groupTasks.length === 0) return 0;
    const done = groupTasks.filter(t => t.completed).length;
    return Math.round((done / groupTasks.length) * 100);
  }, [tasks, activeGroupId]);

  if (loading) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-page gap-4 text-accent">
        <RefreshCw size={40} className="animate-spin" />
        <p className="font-bold uppercase tracking-widest text-[10px]">Initializing DailyLink...</p>
      </div>
    );
  }

  if (view === "landing" && !user && !isGuest) {
    return (
      <div className="relative">
        <Landing 
          onStart={handleSignIn} 
          onStartGuest={() => {
            setIsGuest(true);
            localStorage.setItem("dailylink_is_guest", "true");
            setView("app");
          }}
        />
        {authError && (
          <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[100] w-full max-w-md px-6">
            <div className="bg-red-50 border border-red-200 p-6 rounded-2xl shadow-2xl space-y-4">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center text-red-600 shrink-0">
                  <Bell size={20} />
                </div>
                <div>
                  <h3 className="text-red-900 font-bold">Sign-in issue detected</h3>
                  <p className="text-red-700 text-sm mt-1">{authError}</p>
                </div>
              </div>
              <div className="pt-2">
                <p className="text-xs text-red-600/70 font-medium">
                  Browsers often block popups in iframes. Click the "Open in new tab" icon at the top right of this preview and try again there, or click "Try as Guest / Continue as Guest" to use local-first offline storage.
                </p>
              </div>
              <button 
                onClick={() => setAuthError(null)}
                className="w-full py-2 bg-red-100 text-red-700 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-red-200 transition-colors"
                id="dismissError"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  const handleLogOut = () => {
    if (isGuest) {
      setIsGuest(false);
      localStorage.removeItem("dailylink_is_guest");
      setView("landing");
    } else {
      signOut(auth);
      setView("landing");
    }
  };

  return (
    <div className="flex bg-page h-screen overflow-hidden text-slate-800">
      {/* Sidebar */}
      <aside className="w-80 bg-panel-strong text-white flex flex-col shrink-0 border-r border-white/5">
        <header className="p-8 border-b border-white/10 bg-gradient-to-br from-accent/20 to-transparent">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-accent rounded-xl flex items-center justify-center shadow-lg shadow-accent/20">
                <CheckCircle size={22} className="text-white" />
              </div>
              <span className="text-xl font-black tracking-tight">DailyLink</span>
            </div>
            <button onClick={handleLogOut} className="text-white/40 hover:text-white transition-colors" title="Logout">
              <LogOutIcon size={18} />
            </button>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] font-extrabold text-white/40 uppercase tracking-widest">
              {isGuest ? "Local Guest Workspace" : "Workspace"}
            </p>
            <h2 className="text-2xl font-bold truncate">
              {isGuest ? "Guest User" : user?.displayName || "Member"}
            </h2>
          </div>
          
          {isGuest && (
            <div className="mt-4 p-3 rounded-xl bg-orange-500/10 border border-orange-500/20 flex flex-col gap-1.5 animate-pulse">
              <p className="text-[10px] font-black text-orange-400 uppercase tracking-wider">Local Mode (Offline-First)</p>
              <p className="text-[10px] text-white/50 leading-snug">Data is stored securely on this computer. Sign in for cloud backup.</p>
              <button 
                onClick={() => {
                  setIsGuest(false);
                  localStorage.removeItem("dailylink_is_guest");
                  handleSignIn();
                }}
                className="w-full mt-1 py-1.5 bg-accent hover:bg-accent-dark text-white rounded-lg text-[10px] font-black uppercase tracking-widest transition-colors flex items-center justify-center gap-1.5"
              >
                <LogIn size={11} />
                <span>Go Online (Sign In)</span>
              </button>
            </div>
          )}
          
          {gasPrice && (
            <div className={cn(
              "mt-5 flex items-center gap-2 px-3 py-2.5 rounded-2xl border border-white/10 bg-white/5",
              gasPrice < 20 ? "border-emerald-500/30 text-emerald-400" : 
              gasPrice < 55 ? "border-amber-500/30 text-amber-400" : "border-red-500/30 text-red-400"
            )}>
              <div className="flex items-center gap-2 overflow-hidden text-xs font-bold uppercase tracking-wider">
                <Zap size={14} fill="currentColor" />
                <span>{gasPrice} Gwei</span>
              </div>
            </div>
          )}
        </header>

        <nav className="flex-1 overflow-y-auto p-4 space-y-8">
          <div>
            <div className="flex items-center justify-between px-3 mb-4">
              <p className="text-[10px] font-extrabold text-white/40 uppercase tracking-widest">Your Groups</p>
              <button 
                onClick={() => { setModalError(null); setShowAddGroup(true); }}
                className="w-6 h-6 flex items-center justify-center bg-accent/20 hover:bg-accent text-accent hover:text-white rounded-lg transition-all"
              >
                <Plus size={14} className="bg-[#000000] border border-[#658c08]" />
              </button>
            </div>
            <div className="space-y-1.5">
              {groups.length > 0 ? groups.map(group => (
                <button
                  key={group.id}
                  onClick={() => setActiveGroupId(group.id)}
                  className={cn(
                    "w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all text-sm font-bold group",
                    activeGroupId === group.id 
                      ? "bg-accent text-white shadow-xl shadow-accent/20" 
                      : "text-white/50 hover:bg-white/5 hover:text-white"
                  )}
                >
                  <span className="truncate">{group.name}</span>
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "text-[10px] px-2 py-0.5 rounded-full",
                      activeGroupId === group.id ? "bg-white/20 text-white" : "bg-white/10 text-white/40"
                    )}>
                      {tasks.filter(t => t.groupId === group.id).length}
                    </span>
                    <Trash2 
                      size={14} 
                      className="opacity-0 group-hover:opacity-40 hover:!opacity-100 transition-opacity" 
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsDeletingGroup(group.id);
                      }}
                    />
                  </div>
                </button>
              )) : (
                <div className="p-10 text-center border-2 border-dashed border-white/5 rounded-2xl">
                  <p className="text-xs font-bold text-white/20">No groups yet</p>
                </div>
              )}
            </div>
          </div>
          
          <div className="pt-6 border-t border-white/10">
            <p className="px-3 mb-4 text-[10px] font-extrabold text-white/40 uppercase tracking-widest">Utility</p>
            <div className="grid grid-cols-2 gap-3">
              <button className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/10 transition-all text-white/60 hover:text-white group">
                <Upload size={18} className="text-accent group-hover:scale-110 transition-transform" />
                <span className="text-[10px] font-black uppercase tracking-widest">Import</span>
              </button>
              <button className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/10 transition-all text-white/60 hover:text-white group">
                <Download size={18} className="text-accent group-hover:scale-110 transition-transform" />
                <span className="text-[10px] font-black uppercase tracking-widest">Export</span>
              </button>
            </div>
          </div>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
        <header className="p-10 border-b border-line flex items-center justify-between gap-8 bg-white/80 backdrop-blur-xl shrink-0">
          <div className="min-w-0 space-y-1">
            <p className="text-[10px] font-black text-accent uppercase tracking-[0.2em] mb-2">
              Current Group
            </p>
            <h1 className="text-5xl font-black text-slate-900 tracking-tight leading-none">
              {activeGroup?.name || "Choose a group"}
            </h1>
            <p className="text-slate-400 font-medium text-lg leading-relaxed">
              {activeGroup ? (activeGroup.dailyReset ? "Start fresh every 24 hours." : "Consistency is the key.") : "Select a collection on the left."}
            </p>
          </div>
          
          <div className="flex gap-10 shrink-0 items-center">
            <div className="text-right space-y-2">
              <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Health Score</p>
              <div className="flex items-center gap-4">
                 <span className="text-4xl font-black tabular-nums tracking-tighter">
                  {progress}%
                </span>
                <div className="w-40 h-3 bg-slate-100 rounded-full overflow-hidden shadow-inner flex">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    className="h-full bg-accent relative"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent to-white/20" />
                  </motion.div>
                </div>
              </div>
            </div>
          </div>
        </header>

        <section className="p-10 space-y-8 flex-1 overflow-y-auto">
          <div className="flex flex-wrap items-end gap-6 bg-white p-8 rounded-[32px] border border-line shadow-sm">
            <div className="flex-1 min-w-[300px] space-y-2">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Quick Link</label>
              <div className="relative group">
                <LinkIcon size={20} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-accent transition-colors" />
                <input 
                  type="text" 
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleAddUrl((e.target as HTMLInputElement).value);
                      (e.target as HTMLInputElement).value = "";
                    }
                  }}
                  placeholder="Paste URL and press Enter..."
                  className="w-full bg-slate-50/50 border border-line rounded-2xl py-4.5 pl-14 pr-6 focus:outline-none focus:ring-4 focus:ring-accent/10 focus:border-accent transition-all font-bold text-lg focus:bg-white"
                />
              </div>
            </div>
            
            <div className="w-80 space-y-2">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Global Query</label>
              <div className="relative group">
                <Search size={20} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-accent transition-colors" />
                <input 
                  type="text" 
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Filter tasks..."
                  className="w-full bg-slate-100 border border-transparent rounded-2xl py-4.5 pl-14 pr-6 focus:outline-none focus:ring-4 focus:ring-accent/10 focus:border-accent transition-all font-bold text-lg"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex bg-white p-1.5 rounded-2xl border border-line shadow-sm">
              {(["all", "active", "completed"] as FilterType[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={cn(
                    "px-6 py-2.5 rounded-[10px] text-xs font-black uppercase tracking-widest transition-all",
                    filter === f 
                      ? "bg-accent text-white shadow-lg shadow-accent/20" 
                      : "text-slate-400 hover:text-slate-600"
                  )}
                >
                  {f}
                </button>
              ))}
            </div>
            
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-3">
                <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em]">Automations</p>
                <div className="h-4 w-px bg-line" />
                <label 
                  onClick={toggleDailyReset}
                  className="flex items-center gap-3 cursor-pointer group"
                >
                  <div className={cn(
                    "w-12 h-6 rounded-full transition-all flex items-center p-1",
                    activeGroup?.dailyReset ? "bg-accent" : "bg-slate-200"
                  )}>
                    <motion.div 
                      layout
                      animate={{ x: activeGroup?.dailyReset ? 24 : 0 }}
                      className="w-4 h-4 bg-white rounded-full shadow-md"
                    />
                  </div>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest group-hover:text-accent transition-colors">Daily Resync</span>
                </label>
              </div>
              
              <button 
                onClick={openAllActive}
                disabled={filteredTasks.length === 0} 
                className="flex items-center gap-3 px-8 py-4 rounded-2xl bg-slate-900 text-white text-xs font-black uppercase tracking-widest hover:bg-accent transition-all disabled:opacity-20 disabled:cursor-not-allowed shadow-xl shadow-slate-900/10 active:scale-95"
              >
                <ExternalLink size={16} />
                <span>Blast Open All</span>
              </button>
            </div>
          </div>

          <div className="space-y-4 pb-20">
            <AnimatePresence mode="popLayout" initial={false}>
              {filteredTasks.length > 0 ? (
                filteredTasks.map((task) => (
                  <motion.div
                    key={task.id}
                    layoutId={task.id}
                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, x: -20 }}
                    className={cn(
                      "group flex items-center gap-6 p-6 bg-white border border-line rounded-3xl hover:border-accent/40 hover:shadow-2xl hover:shadow-accent/5 transition-all relative overflow-hidden",
                      task.completed && "bg-slate-50/50"
                    )}
                  >
                     <div className="w-1.5 h-full absolute left-0 top-0 bg-transparent group-hover:bg-accent/40 transition-colors" />
                    
                    <div className="cursor-grab text-slate-200 hover:text-accent transition-colors shrink-0">
                      <GripVertical size={24} />
                    </div>

                    <button 
                      onClick={() => toggleTask(task)}
                      className={cn(
                        "w-8 h-8 rounded-xl flex items-center justify-center transition-all shrink-0",
                        task.completed 
                          ? "bg-accent text-white shadow-lg shadow-accent/20" 
                          : "border-2 border-slate-100 text-transparent hover:border-accent/50 hover:bg-accent/5"
                      )}
                    >
                      <CheckCircle size={18} />
                    </button>
                    
                    <div className="w-14 h-14 rounded-2xl bg-slate-50 p-2.5 shrink-0 shadow-inner flex items-center justify-center border border-line">
                      <img 
                        src={task.favicon} 
                        alt="" 
                        className="w-full h-full object-contain"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = `https://www.google.com/s2/favicons?domain=${new URL(replaceVariables(task.url)).hostname}&sz=64`;
                        }}
                      />
                    </div>
                    
                    <div className="flex-1 min-w-0 space-y-1">
                      <a 
                        href={replaceVariables(task.url)} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className={cn(
                          "text-xl font-black block truncate hover:text-accent transition-colors tracking-tight",
                          task.completed && "text-slate-400 line-through decoration-[3px]"
                        )}
                      >
                        {task.title}
                      </a>
                      <div className="flex items-center gap-3">
                        <p className="text-xs text-slate-400 font-bold truncate tracking-wide">{getReadableUrl(task.url)}</p>
                        {task.notes && (
                          <>
                            <div className="w-1 h-1 bg-slate-200 rounded-full" />
                            <p className="text-xs text-slate-500 font-medium truncate italic">“{task.notes}”</p>
                          </>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all transform translate-x-4 group-hover:translate-x-0">
                      <button className="p-3 text-slate-300 hover:text-accent hover:bg-accent/10 rounded-xl transition-all">
                        <Edit2 size={20} />
                      </button>
                      <button 
                        onClick={() => setTaskToDelete(task.id)}
                        className="p-3 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                      >
                        <Trash2 size={20} />
                      </button>
                    </div>
                  </motion.div>
                ))
              ) : (
                <div className="py-24 text-center space-y-6">
                  <div className="w-24 h-24 bg-slate-50 rounded-[40px] flex items-center justify-center mx-auto text-slate-200 shadow-inner">
                    <Layout size={40} />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-2xl font-black text-slate-800 tracking-tight">System holds no entries</h3>
                    <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Filter: {filter} / Query: {search || "None"}</p>
                  </div>
                  <button onClick={() => setSearch("")} className="text-accent font-black uppercase tracking-widest text-[10px] hover:underline">Clear Search</button>
                </div>
              )}
            </AnimatePresence>
          </div>
        </section>

        {/* Modals */}
        <AnimatePresence>
          {showAddGroup && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowAddGroup(false)}
                className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="relative w-full max-w-md bg-white rounded-[32px] p-10 shadow-2xl space-y-8"
              >
                <div className="space-y-2">
                  <h2 className="text-3xl font-black tracking-tight">Create Group</h2>
                  <p className="text-slate-500 font-medium italic">A collection for your routine links.</p>
                </div>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Name</label>
                    <input 
                      autoFocus
                      type="text"
                      placeholder="e.g. MORNING WORK"
                      value={newGroupName}
                      onChange={(e) => setNewGroupName(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleAddGroup()}
                      className="w-full bg-slate-50 border border-line rounded-2xl py-4 px-6 focus:outline-none focus:ring-4 focus:ring-accent/10 focus:border-accent transition-all font-bold text-lg"
                    />
                  </div>
                  {modalError && (
                    <div className="p-4 bg-red-50 text-red-600 rounded-2xl text-xs font-bold leading-relaxed border border-red-100">
                      {modalError}
                    </div>
                  )}
                  <div className="flex gap-4 pt-4">
                    <button 
                      onClick={() => setShowAddGroup(false)}
                      className="flex-1 py-4 rounded-2xl border border-line font-black text-xs uppercase tracking-widest text-slate-400 hover:bg-slate-50 transition-all"
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={handleAddGroup}
                      className="flex-1 py-4 rounded-2xl bg-accent text-white font-black text-xs uppercase tracking-widest shadow-lg shadow-accent/20 hover:bg-accent-dark transition-all"
                    >
                      Create
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}

          {(taskToDelete || isDeletingGroup) && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
               <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => { setTaskToDelete(null); setIsDeletingGroup(null); }}
                className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="relative w-full max-w-md bg-white rounded-[32px] p-10 shadow-2xl space-y-8"
              >
                <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center text-red-500 mx-auto">
                  <Trash2 size={32} />
                </div>
                <div className="space-y-2 text-center">
                  <h2 className="text-3xl font-black tracking-tight text-slate-900">Are you sure?</h2>
                  <p className="text-slate-500 font-medium leading-relaxed">
                    This action is permanent and cannot be undone. 
                    {isDeletingGroup ? " All tasks within this group will also be deleted." : " This link will be removed from your workspace."}
                  </p>
                </div>
                <div className="flex gap-4 pt-2">
                  <button 
                    onClick={() => { setTaskToDelete(null); setIsDeletingGroup(null); }}
                    className="flex-1 py-4 rounded-2xl border border-line font-black text-xs uppercase tracking-widest text-slate-400 hover:bg-slate-50 transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={() => isDeletingGroup ? deleteGroup(isDeletingGroup) : taskToDelete && deleteTask(taskToDelete)}
                    className="flex-1 py-4 rounded-2xl bg-red-500 text-white font-black text-xs uppercase tracking-widest shadow-lg shadow-red-500/20 hover:bg-red-600 transition-all"
                  >
                    Delete Now
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
