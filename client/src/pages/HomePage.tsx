import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useUser } from "../hooks/use-user";
import MediaGallery from "../components/MediaGallery";
import FamilyTree from "../components/FamilyTree";
import MediaUpload from "../components/MediaUpload";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Menu } from "lucide-react";

export default function HomePage() {
  const { user, logout } = useUser();
  const [view, setView] = useState<"gallery" | "tree">("gallery");

  return (
    <div className="min-h-screen bg-orange-50">
      <header className="bg-white border-b shadow-sm">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-primary">Family Media</h1>
          
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
                  >
                    Media Gallery
                  </Button>
                  <Button
                    variant={view === "tree" ? "default" : "ghost"}
                    onClick={() => setView("tree")}
                  >
                    Family Tree
                  </Button>
                  <Button variant="outline" onClick={() => logout()}>
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
                variant={view === "tree" ? "default" : "ghost"}
                onClick={() => setView("tree")}
              >
                Family Tree
              </Button>
              <Button variant="outline" onClick={() => logout()}>
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
        ) : (
          <FamilyTree />
        )}
      </main>
    </div>
  );
}
