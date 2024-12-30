import { Switch, Route } from "wouter";
import { Loader2 } from "lucide-react";
import { useUser } from "./hooks/use-user";
import AuthPage from "./pages/AuthPage";
import HomePage from "./pages/HomePage";

function App() {
  const { user, isLoading } = useUser();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // If not authenticated, show login page
  if (!user) {
    return <AuthPage />;
  }

  // If authenticated, show main app routes
  return (
    <Switch>
      <Route path="/" component={HomePage} />
    </Switch>
  );
}

export default App;