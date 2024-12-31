import { useUser } from "../hooks/use-user";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import type { MediaItem } from "@db/schema";
import { Menu } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";

export default function TaggedMediaPage() {
  const { user, logout } = useUser();

  const { data: taggedMedia = [] } = useQuery<MediaItem[]>({
    queryKey: ["/api/media/tagged", user?.id],
    enabled: !!user,
  });

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  if (!user) {
    return null;
  }

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
                  <Link href="/">
                    <Button variant="ghost" className="w-full">
                      Media Gallery
                    </Button>
                  </Link>
                  <Link href="/">
                    <Button variant="ghost" className="w-full">
                      Albums
                    </Button>
                  </Link>
                  <Link href="/">
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
              <Link href="/">
                <Button variant="ghost">Albums</Button>
              </Link>
              <Link href="/">
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
        <Card>
          <CardHeader>
            <CardTitle>All Tagged Media</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {taggedMedia.length > 0 ? (
                taggedMedia.map((media) => (
                  <div key={media.id} className="flex items-center gap-4">
                    {media.type === 'photo' && (
                      <img 
                        src={media.url} 
                        alt={media.title}
                        className="w-16 h-16 object-cover rounded-md"
                      />
                    )}
                    <div>
                      <h4 className="font-medium">{media.title}</h4>
                      <p className="text-sm text-muted-foreground">
                        {media.description}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-muted-foreground">No tagged media</p>
              )}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
