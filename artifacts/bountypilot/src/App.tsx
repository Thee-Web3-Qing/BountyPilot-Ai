import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { Layout } from "@/components/layout";
import { AuthProvider, useAuth } from "@/contexts/auth";

import { Dashboard } from "./pages/dashboard";
import { Bounties } from "./pages/bounties";
import { BountyAdd } from "./pages/bounty-add";
import { BountyDetail } from "./pages/bounty-detail";
import { Submissions } from "./pages/submissions";
import { Earnings } from "./pages/earnings";
import { Login } from "./pages/login";
import { Signup } from "./pages/signup";
import { Profile } from "./pages/profile";
import { Settings } from "./pages/settings";
import { Discover } from "./pages/discover";
import { Landing } from "./pages/landing";

const queryClient = new QueryClient();

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  if (!isAuthenticated) {
    navigate("/login");
    return null;
  }
  return <Component />;
}

function Router() {
  const { isAuthenticated } = useAuth();

  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/signup" component={Signup} />
      <Route path="/" nest>
        {isAuthenticated ? (
          <Layout>
            <Switch>
              <Route path="/" component={Dashboard} />
              <Route path="/discover" component={Discover} />
              <Route path="/bounties" component={Bounties} />
              <Route path="/bounties/add" component={BountyAdd} />
              <Route path="/bounties/:id" component={BountyDetail} />
              <Route path="/submissions" component={Submissions} />
              <Route path="/earnings" component={Earnings} />
              <Route path="/profile" component={Profile} />
              <Route path="/settings" component={Settings} />
              <Route component={NotFound} />
            </Switch>
          </Layout>
        ) : (
          <Switch>
            <Route path="/" component={Landing} />
            <Route component={Login} />
          </Switch>
        )}
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
        </AuthProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
