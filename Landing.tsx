import React from "react";
import { 
  CheckCircle, 
  Rocket, 
  Zap, 
  RefreshCw, 
  Smartphone, 
  ShieldCheck, 
  CreditCard, 
  ChevronRight,
  Search,
  Layout,
  Download
} from "lucide-react";
import { motion } from "motion/react";

interface LandingProps {
  onStart: () => void;
  onStartGuest: () => void;
}

export default function Landing({ onStart, onStartGuest }: LandingProps) {
  return (
    <div className="min-h-screen bg-page text-slate-900 selection:bg-accent/20 overflow-x-hidden">
      {/* Topbar */}
      <nav className="fixed top-0 left-0 right-0 h-20 bg-white/70 backdrop-blur-xl border-b border-line z-50 px-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-accent rounded-xl flex items-center justify-center text-white shadow-lg shadow-accent/20">
            <CheckCircle size={20} />
          </div>
          <span className="text-xl font-black tracking-tight">DailyLink</span>
        </div>
        <div className="flex items-center gap-4 md:gap-6">
          <div className="hidden md:flex gap-6 text-sm font-bold text-slate-400">
            <a href="#features" className="hover:text-accent transition-colors">Features</a>
            <a href="#pricing" className="hover:text-accent transition-colors">Pricing</a>
            <a href="#privacy" className="hover:text-accent transition-colors">Privacy</a>
          </div>
          <button 
            onClick={onStartGuest}
            className="text-slate-600 hover:text-accent px-4 py-2.5 rounded-xl font-bold text-sm transition-all"
          >
            <span>Try as Guest</span>
          </button>
          <button 
            onClick={onStart}
            className="bg-accent text-white px-5 md:px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-accent-dark transition-all transform active:scale-95 text-sm"
          >
            <span>Sign In</span>
            <ChevronRight size={16} />
          </button>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-40 pb-20 px-8 max-w-7xl mx-auto grid lg:grid-cols-2 gap-16 items-center">
        <motion.div 
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          className="space-y-8"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-accent/10 rounded-full text-[10px] font-black uppercase tracking-widest text-accent">
            <Zap size={12} fill="currentColor" />
            <span>Daily Task Manager</span>
          </div>
          <h1 className="text-7xl md:text-8xl font-black tracking-tight leading-[0.9] text-slate-900">
            DailyLink<span className="text-accent">.</span>
          </h1>
          <p className="text-xl md:text-2xl font-medium text-slate-500 leading-relaxed max-w-xl">
            Open your daily work links, track progress, and never miss due URLs. Built for repeat workflows.
          </p>
          <div className="flex flex-wrap gap-4">
            <button 
              onClick={onStart}
              className="bg-accent text-white px-8 py-4 rounded-2xl font-bold text-lg flex items-center gap-3 hover:bg-accent-dark transition-all shadow-xl shadow-accent/20"
            >
              <Rocket size={24} />
              <span>Launch Workspace</span>
            </button>
            <button 
              onClick={onStartGuest}
              className="bg-white border border-line text-slate-600 hover:text-accent hover:border-accent/40 px-8 py-4 rounded-2xl font-bold text-lg flex items-center gap-3 transition-all"
            >
              <Zap size={24} />
              <span>Continue as Guest</span>
            </button>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, scale: 0.9, rotate: 2 }}
          animate={{ opacity: 1, scale: 1, rotate: 0 }}
          className="relative aspect-square lg:aspect-[4/3] rounded-[40px] overflow-hidden shadow-2xl border-8 border-white group"
        >
          <img 
            src="https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&q=80&w=2426" 
            alt="App Preview"
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 to-transparent flex flex-col justify-end p-10 text-white">
            <h3 className="text-2xl font-bold mb-2">Productivity at its peak</h3>
            <p className="text-white/80 font-medium">Clean, focused, and systematic design for your daily links.</p>
          </div>
        </motion.div>
      </section>

      {/* Features */}
      <section id="features" className="py-32 bg-white/40">
        <div className="max-w-7xl mx-auto px-8">
          <div className="mb-20 space-y-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-accent">Capabilities</p>
            <h2 className="text-5xl font-black tracking-tight leading-none">Everything you need.</h2>
            <p className="text-xl font-medium text-slate-500 max-w-2xl">
              Metadata fetching, search, filters, drag & drop, and daily resets built into one fluid interface.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              { icon: Zap, title: "Auto Title & Favicon", desc: "Pasted URLs get readable titles and domain previews automatically." },
              { icon: Search, title: "Search & Filters", desc: "Find tasks instantly. Filter by active, completed, or due dates." },
              { icon: RefreshCw, title: "Daily Reset", desc: "Routines reset every morning so you can start fresh every single day." },
              { icon: Layout, title: "Drag & Drop", desc: "Reorder your priorities naturally with a modern interaction model." },
              { icon: Download, title: "Open All", desc: "Launch all active links in a single group with one powerful click." },
              { icon: ShieldCheck, title: "Privacy First", desc: "Your data is stored securely and belongs entirely to you." },
            ].map((f, i) => (
              <motion.div 
                whileHover={{ y: -8 }}
                key={i} 
                className="p-10 bg-white border border-line rounded-3xl shadow-sm hover:shadow-xl hover:shadow-accent/5 transition-all space-y-6"
              >
                <div className="w-14 h-14 bg-accent/10 rounded-2xl flex items-center justify-center text-accent">
                  <f.icon size={28} />
                </div>
                <h3 className="text-2xl font-bold tracking-tight">{f.title}</h3>
                <p className="text-slate-500 font-medium leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-32">
        <div className="max-w-7xl mx-auto px-8">
          <div className="grid lg:grid-cols-2 gap-20 items-center">
            <div className="space-y-8">
              <p className="text-[10px] font-black uppercase tracking-widest text-accent">Pricing</p>
              <h2 className="text-6xl font-black tracking-tight leading-none">Simple early offer.</h2>
              <p className="text-xl font-medium text-slate-500 leading-relaxed">
                We are building for the long haul. Support the development and get lifetime access today.
              </p>
              <div className="space-y-4">
                {["Unlimited Groups", "Unlimited Tasks", "Full Metadata Support", "Daily Reset Automations"].map((item, i) => (
                  <div key={i} className="flex items-center gap-3 font-bold text-slate-700">
                    <CheckCircle size={20} className="text-accent" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="p-12 bg-panel-strong rounded-[40px] shadow-2xl text-white space-y-10 relative overflow-hidden">
               <div className="absolute top-0 right-0 w-64 h-64 bg-accent/20 blur-[100px] rounded-full -mr-32 -mt-32" />
               <div className="space-y-4">
                 <h3 className="text-3xl font-black tracking-tight text-accent-soft">Lifetime Deal</h3>
                 <div className="flex items-baseline gap-2">
                   <span className="text-7xl font-black tracking-tighter">$20</span>
                   <span className="text-white/40 font-bold uppercase tracking-widest text-sm">One-time</span>
                 </div>
               </div>
               <p className="text-white/60 font-medium">Join our early user club and shape the future of DailyLink.</p>
               <button className="w-full bg-white text-panel-strong py-5 rounded-2xl font-black text-xl hover:bg-accent-soft transition-all transform active:scale-[0.98]">
                 Get Started Now
               </button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-20 border-t border-line bg-white/40 text-center">
        <p className="text-slate-400 font-bold text-sm tracking-wide">© 2024 DailyLink. Built for productivity.</p>
      </footer>
    </div>
  );
}
