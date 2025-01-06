import AlbumManager from "../components/AlbumManager";
import { useUser } from "../hooks/use-user";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Menu } from "lucide-react";

export default function AlbumsPage() {
  const { user, logout } = useUser();

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  return (
    <div className="min-h-screen bg-orange-50">
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
                  <Link href="/">
                    <Button variant="ghost" className="w-full">
                      Media Gallery
                    </Button>
                  </Link>
                  <Link href="/albums">
                    <Button variant="default" className="w-full">
                      Albums
                    </Button>
                  </Link>
                  <Link href="/family">
                    <Button variant="ghost" className="w-full">
                      Family Tree
                    </Button>
                  </Link>
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
              <Link href="/">
                <Button variant="ghost">Media Gallery</Button>
              </Link>
              <Link href="/albums">
                <Button variant="default">Albums</Button>
              </Link>
              <Link href="/family">
                <Button variant="ghost">Family Tree</Button>
              </Link>
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
        <AlbumManager />
      </main>
    </div>
  );
}
