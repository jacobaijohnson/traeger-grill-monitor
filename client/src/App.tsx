import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, Redirect } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import Controls from "./pages/Controls";
import CookPrograms from "./pages/CookPrograms";
import LiveCook from "./pages/LiveCook";
import History from "./pages/History";
import Analytics from "./pages/Analytics";
import Settings from "./pages/Settings";
import DashboardLayout from "./components/DashboardLayout";

function Router() {
  return (
    <DashboardLayout>
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
        <Route path={"/404"} component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </DashboardLayout>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
