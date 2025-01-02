import { Switch, Route } from "wouter";
import { Loader2 } from "lucide-react";
import { useUser } from "./hooks/use-user";
import AuthPage from "./pages/AuthPage";
import HomePage from "./pages/HomePage";
import ProfilePage from "./pages/ProfilePage";
import UploadedMediaPage from "./pages/UploadedMediaPage";
import TaggedMediaPage from "./pages/TaggedMediaPage";
import FamilyTree from "./components/FamilyTree";

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
      <Route path="/family" component={FamilyPage} />
    </Switch>
  );
}

// Wrapper component for the Family Tree page to provide consistent layout
function FamilyPage() {
  const { user, logout } = useUser();

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  return (
    <div className="min-h-screen bg-primary/10">
      <header className="bg-white border-b shadow-sm">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-[#7c6f9f]">Archivo</h1>
          <nav className="hidden md:flex items-center gap-2">
            <Link href="/">
              <Button variant="ghost">Media Gallery</Button>
            </Link>
            <Link href="/albums">
              <Button variant="ghost">Albums</Button>
            </Link>
            <Link href="/family">
              <Button variant="default">Family Tree</Button>
            </Link>
            <Link href="/profile">
              <Button variant="ghost">Profile</Button>
            </Link>
            <Button variant="outline" onClick={handleLogout}>
              Logout
            </Button>
          </nav>
        </div>
      </header>
      <main className="container mx-auto px-4 py-8">
        <FamilyTree onUserClick={(userId) => window.location.href = `/profile/${userId}`} />
      </main>
    </div>
  );
}

export default App;