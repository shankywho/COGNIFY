import React, { Suspense, lazy } from "react";
import { BrowserRouter as Router, Routes, Route, Outlet, Navigate } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { ThemeProvider } from "@/context/theme-provider";
import { Nav as Navbar } from "./pages/landingpage/Home";
import { Footer } from "@/components/footer";

// Eagerly loaded primary landing page for sub-millisecond LCP
import Home from "./pages/landingpage/Home";

// Lazy-loaded marketing sub-pages (Split into on-demand chunks)
const About = lazy(() => import("./pages/landingpage/About"));
const Blog = lazy(() => import("./pages/landingpage/Blog"));
const BlogPost = lazy(() => import("./pages/landingpage/BlogPost"));
const Careers = lazy(() => import("./pages/landingpage/Careers"));
const Contact = lazy(() => import("./pages/landingpage/Contact"));
const Playground = lazy(() => import("./pages/landingpage/Playground"));
const Pricing = lazy(() => import("./pages/landingpage/Pricing"));
const SignIn = lazy(() => import("./pages/landingpage/SignIn"));
const SignUp = lazy(() => import("./pages/landingpage/SignUp"));

// Lazy-loaded heavy dashboard pages (Drastically reduces initial landing bundle)
const DashboardLayout = lazy(() => import("./pages/dashboard/DashboardLayout").then((m) => ({ default: m.DashboardLayout })));
const AIChat = lazy(() => import("./pages/dashboard/AIChat").then((m) => ({ default: m.AIChat })));
const Prompts = lazy(() => import("./pages/dashboard/Prompts").then((m) => ({ default: m.Prompts })));
const Integrations = lazy(() => import("./pages/dashboard/Integrations").then((m) => ({ default: m.Integrations })));
const Memory = lazy(() => import("./pages/dashboard/Memory").then((m) => ({ default: m.Memory })));
const Files = lazy(() => import("./pages/dashboard/Files").then((m) => ({ default: m.Files })));
const Workflows = lazy(() => import("./pages/dashboard/Workflows").then((m) => ({ default: m.Workflows })));
const Collaboration = lazy(() => import("./pages/dashboard/Collaboration").then((m) => ({ default: m.Collaboration })));
const APIKeys = lazy(() => import("./pages/dashboard/APIKeys").then((m) => ({ default: m.APIKeys })));
const Settings = lazy(() => import("./pages/dashboard/Settings").then((m) => ({ default: m.Settings })));
const NotFound = lazy(() => import("./pages/NotFound").then((m) => ({ default: m.NotFound })));

const RouteLoadingFallback = () => (
  <div className="min-h-screen bg-black flex items-center justify-center select-none">
    <div className="flex flex-col items-center gap-3">
      <div className="h-6 w-6 rounded-full border-2 border-white/10 border-t-white animate-spin" />
      <span className="font-mono text-[11px] text-zinc-500 tracking-wider uppercase">Loading runtime...</span>
    </div>
  </div>
);

// Public layout with marketing navbar & footer
const PublicLayout = () => {
  return (
    <div className="min-h-screen bg-white dark:bg-black text-foreground">
      <Navbar />
      <div className="pt-16">
        <Suspense fallback={<RouteLoadingFallback />}>
          <Outlet />
        </Suspense>
      </div>
      <Footer />
    </div>
  );
};

// Auth layout always forces dark mode
const AuthLayout = () => {
  return (
    <div className="dark min-h-screen bg-background text-foreground">
      <Navbar />
      <div className="pt-16">
        <Suspense fallback={<RouteLoadingFallback />}>
          <Outlet />
        </Suspense>
      </div>
      <Footer />
    </div>
  );
};

function App() {
  return (
    <HelmetProvider>
      <ThemeProvider>
        <Router>
          <Suspense fallback={<RouteLoadingFallback />}>
            <Routes>
              {/* Public Marketing Landing Pages */}
              <Route path="/" element={<Home />} />
              <Route element={<PublicLayout />}>
                <Route path="/about" element={<About />} />
                <Route path="/blog" element={<Blog />} />
                <Route path="/blog/:slug" element={<BlogPost />} />
                <Route path="/careers" element={<Careers />} />
                <Route path="/contact" element={<Contact />} />
                <Route path="/playground" element={<Playground />} />
                <Route path="/pricing" element={<Pricing />} />
              </Route>

              {/* Auth Pages (Forced Dark Mode) */}
              <Route element={<AuthLayout />}>
                <Route path="/sign-in" element={<SignIn />} />
                <Route path="/sign-up" element={<SignUp />} />
              </Route>

              {/* Private SaaS Dashboard (AI Operations Platform) */}
              <Route path="/dashboard" element={<DashboardLayout />}>
                <Route index element={<Navigate to="/dashboard/chat" replace />} />
                <Route path="chat" element={<AIChat />} />
                <Route path="workspaces" element={<AIChat />} />
                <Route path="agents" element={<AIChat />} />
                <Route path="analytics" element={<AIChat />} />
                <Route path="prompts" element={<Prompts />} />
                <Route path="integrations" element={<Integrations />} />
                <Route path="memory" element={<Memory />} />
                <Route path="files" element={<Files />} />
                <Route path="workflows" element={<Workflows />} />
                <Route path="collaboration" element={<Collaboration />} />
                <Route path="apikeys" element={<APIKeys />} />
                <Route path="billing" element={<Navigate to="/dashboard/chat?plan=PRO" replace />} />
                <Route path="settings" element={<Settings />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </Router>
      </ThemeProvider>
    </HelmetProvider>
  );
}

export default App;
