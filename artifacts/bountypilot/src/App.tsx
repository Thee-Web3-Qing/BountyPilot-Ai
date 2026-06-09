import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { Layout } from "@/components/layout";

// We will create these pages next
import { Dashboard } from "./pages/dashboard";
import { Bounties } from "./pages/bounties";
import { BountyAdd } from "./pages/bounty-add";
import { BountyDetail } from "./pages/bounty-detail";
import { Submissions } from "./pages/submissions";
import { Earnings } from "./pages/earnings";

const queryClient = new QueryClient();

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/bounties" component={Bounties} />
        <Route path="/bounties/add" component={BountyAdd} />
        <Route path="/bounties/:id" component={BountyDetail} />
        <Route path="/submissions" component={Submissions} />
        <Route path="/earnings" component={Earnings} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
