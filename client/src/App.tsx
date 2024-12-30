import { Switch, Route } from "wouter";
import { Loader2 } from "lucide-react";
import AuthPage from "./pages/AuthPage";
import HomePage from "./pages/HomePage";
import { useUser } from "./hooks/use-user";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";

function App() {
  const { user, isLoading } = useUser();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <Switch>
        <Route path="/" component={HomePage} />
      </Switch>
      <Toaster />
    </QueryClientProvider>
  );
}

export default App;
