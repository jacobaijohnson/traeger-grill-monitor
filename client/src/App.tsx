import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, Redirect } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import DashboardLayout from "./components/DashboardLayout";
import { AlarmBanner } from "./components/AlarmBanner";

// ─── PERF-1: Lazy-loaded route pages (code splitting) ───
// Each page becomes a separate chunk, reducing initial bundle size.
const Home = lazy(() => import("./pages/Home"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Controls = lazy(() => import("./pages/Controls"));
const CookPrograms = lazy(() => import("./pages/CookPrograms"));
const LiveCook = lazy(() => import("./pages/LiveCook"));
const History = lazy(() => import("./pages/History"));
const Analytics = lazy(() => import("./pages/Analytics"));
const Settings = lazy(() => import("./pages/Settings"));
const AdminSettings = lazy(() => import("./pages/AdminSettings"));
const Login = lazy(() => import("./pages/Login"));
const Register = lazy(() => import("./pages/Register"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Setup = lazy(() => import("./pages/Setup"));

/** Minimal loading fallback — keeps layout stable during chunk load */
function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
    </div>
  );
}

function Router() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Switch>
        {/* Public auth routes — outside DashboardLayout */}
        <Route path={"/setup"} component={Setup} />
        <Route path={"/login"} component={Login} />
        <Route path={"/register"} component={Register} />
        <Route path={"/forgot-password"} component={ForgotPassword} />
        <Route path={"/reset-password"} component={ResetPassword} />

        {/* Authenticated dashboard routes */}
        <Route>
          {() => (
            <DashboardLayout>
              <Suspense fallback={<PageLoader />}>
                <Switch>
                  <Route path={"/"} component={Home} />
                  <Route path={"/dashboard"} component={Dashboard} />
                  <Route path={"/controls"} component={Controls} />
                  <Route path={"/cook-programs"} component={CookPrograms} />
                  {/* Redirect old routes to unified Cook Programs */}
                  <Route path={"/cook-guide"}>{() => <Redirect to="/cook-programs" />}</Route>
                  <Route path={"/automation"}>{() => <Redirect to="/cook-programs" />}</Route>
                  <Route path={"/live-cook"} component={LiveCook} />
                  <Route path={"/history"} component={History} />
                  <Route path={"/analytics"} component={Analytics} />
                  <Route path={"/settings"} component={Settings} />
                  <Route path={"/admin"} component={AdminSettings} />
                  <Route path={"/404"} component={NotFound} />
                  <Route component={NotFound} />
                </Switch>
              </Suspense>
            </DashboardLayout>
          )}
        </Route>
      </Switch>
    </Suspense>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster />
          <AlarmBanner />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
