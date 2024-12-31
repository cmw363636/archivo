import { Switch, Route } from "wouter";
import { Loader2 } from "lucide-react";
import { useUser } from "./hooks/use-user";
import AuthPage from "./pages/AuthPage";
import HomePage from "./pages/HomePage";
import ProfilePage from "./pages/ProfilePage";
import UploadedMediaPage from "./pages/UploadedMediaPage";
import TaggedMediaPage from "./pages/TaggedMediaPage";

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
      <Route path="/profile" component={ProfilePage} />
      <Route path="/profile/:id" component={ProfilePage} />
      <Route path="/profile/:id/uploaded" component={UploadedMediaPage} />
      <Route path="/profile/:id/tagged" component={TaggedMediaPage} />
    </Switch>
  );
}

export default App;