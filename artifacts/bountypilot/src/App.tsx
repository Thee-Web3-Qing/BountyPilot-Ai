import { useEffect } from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { Layout } from "@/components/layout";
import { AuthProvider, useAuth } from "@/contexts/auth";
import { trackPageLoad, trackPendo } from "@/lib/pendo";

import { Dashboard } from "./pages/dashboard";
import { Bounties } from "./pages/bounties";
import { BountyAdd } from "./pages/bounty-add";
import { BountyDetail } from "./pages/bounty-detail";
import { Submissions } from "./pages/submissions";
import { Earnings } from "./pages/earnings";
import { Login } from "./pages/login";
import { LoginOTP } from "./pages/login-otp";
import { Signup } from "./pages/signup";
import { ForgotPassword } from "./pages/forgot-password";
import { ResetPassword } from "./pages/reset-password";
import { Profile } from "./pages/profile";
import { Settings } from "./pages/settings";
import { Discover } from "./pages/discover";
import { Landing } from "./pages/landing";
import { Pricing } from "./pages/pricing";
import { Admin } from "./pages/admin";

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

function PageTracker() {
  const [location] = useLocation();
  const { user } = useAuth();

  useEffect(() => {
    trackPageLoad();
    trackPendo("PageView", { path: location, userId: user?.id ?? "anonymous" });
  }, [location, user]);

  return null;
}

function Router() {
  const { isAuthenticated } = useAuth();

  return (
    <>
      <PageTracker />
      <Switch>
        <Route path="/login" component={Login} />
        <Route path="/login-otp" component={LoginOTP} />
        <Route path="/signup" component={Signup} />
        <Route path="/forgot-password" component={ForgotPassword} />
        <Route path="/reset-password" component={ResetPassword} />
        <Route path="/pricing" component={Pricing} />
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
                <Route path="/admin" component={Admin} />
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
    </>
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
