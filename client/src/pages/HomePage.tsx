import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useUser } from "../hooks/use-user";
import { MediaGallery } from "../components/MediaGallery";
import FamilyTree from "../components/FamilyTree";
import MediaUpload from "../components/MediaUpload";
import AlbumManager from "../components/AlbumManager";
import { Link } from "wouter";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Menu } from "lucide-react";

export default function HomePage() {
  const { user, logout } = useUser();
  const [view, setView] = useState<"gallery" | "tree" | "albums">("gallery");

  // Check for saved view state on component mount
  useEffect(() => {
    const savedView = localStorage.getItem("homePageView");
    if (savedView === "gallery" || savedView === "tree" || savedView === "albums") {
      setView(savedView);
      // Clear the saved view after using it
      localStorage.removeItem("homePageView");
    }
  }, []);

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

          <div className="flex items-center gap-4">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent>
                <nav className="flex flex-col gap-2 pt-4">
                  <Button
                    variant={view === "gallery" ? "default" : "ghost"}
                    onClick={() => setView("gallery")}
                    className="w-full"
                  >
                    Media Gallery
                  </Button>
                  <Button
                    variant={view === "albums" ? "default" : "ghost"}
                    onClick={() => setView("albums")}
                    className="w-full"
                  >
                    Albums
                  </Button>
                  <Button
                    variant={view === "tree" ? "default" : "ghost"}
                    onClick={() => setView("tree")}
                    className="w-full"
                  >
                    Family Tree
                  </Button>
                  <Link href="/profile">
                    <Button variant="ghost" className="w-full">
                      Profile
                    </Button>
                  </Link>
                  <Button variant="outline" onClick={handleLogout}>
                    Logout
                  </Button>
                </nav>
              </SheetContent>
            </Sheet>

            <nav className="hidden md:flex items-center gap-2">
              <Button
                variant={view === "gallery" ? "default" : "ghost"}
                onClick={() => setView("gallery")}
              >
                Media Gallery
              </Button>
              <Button
                variant={view === "albums" ? "default" : "ghost"}
                onClick={() => setView("albums")}
              >
                Albums
              </Button>
              <Button
                variant={view === "tree" ? "default" : "ghost"}
                onClick={() => setView("tree")}
              >
                Family Tree
              </Button>
              <Link href="/profile">
                <Button variant="ghost">Profile</Button>
              </Link>
              <Button variant="outline" onClick={handleLogout}>
                Logout
              </Button>
            </nav>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {view === "gallery" ? (
          <>
            <MediaUpload />
            <MediaGallery />
          </>
        ) : view === "albums" ? (
          <AlbumManager />
        ) : (
          <FamilyTree />
        )}
      </main>
    </div>
  );
}