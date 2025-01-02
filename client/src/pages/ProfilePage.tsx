import { useState, useEffect } from "react";
import { UserProfileEditor } from "../components/UserProfileEditor";
import { useUser } from "../hooks/use-user";
import FamilyTree from "../components/FamilyTree";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link, useParams, useLocation } from "wouter";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Menu, Link2, ArrowLeft } from "lucide-react";
import type { MediaItem } from "@db/schema";
import { MediaDialog } from "../components/MediaDialog";
import { MediaGallery } from "../components/MediaGallery";
import AlbumManager from "../components/AlbumManager";

export default function ProfilePage() {
  const { user, logout } = useUser();
  const params = useParams();
  const [, navigate] = useLocation();
  const [view, setView] = useState<"gallery" | "tree" | "albums" | null>(null);
  const [selectedMedia, setSelectedMedia] = useState<MediaItem | null>(null);

  // Get userId from URL params or fall back to current user's ID
  const userId = params.id ? parseInt(params.id) : user?.id;
  const isOwnProfile = userId === user?.id;

  // Query for the profile user's data if it's not the current user
  const { data: profileUser } = useQuery({
    queryKey: ["/api/users", userId],
    enabled: !!userId && !isOwnProfile,
  });

  // Use either the fetched profile user or the current user
  const displayUser = isOwnProfile ? user : profileUser;

  // Query for media where user is tagged
  const { data: taggedMedia = [] } = useQuery<MediaItem[]>({
    queryKey: ["/api/media/tagged", userId],
    queryFn: async () => {
      const response = await fetch(`/api/media/tagged?userId=${userId}`, {
        credentials: 'include'
      });
      if (!response.ok) {
        throw new Error('Failed to fetch tagged media');
      }
      return response.json();
    },
    enabled: !!userId,
  });

  // Query for media uploaded by the profile user
  const { data: uploadedMedia = [] } = useQuery<MediaItem[]>({
    queryKey: ["/api/media", userId],
    queryFn: async () => {
      const response = await fetch(`/api/media?userId=${userId}&uploaded=true`, {
        credentials: 'include'
      });
      if (!response.ok) {
        throw new Error('Failed to fetch uploaded media');
      }
      return response.json();
    },
    enabled: !!userId,
  });

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  if (!displayUser) {
    return null;
  }

  const renderContent = () => {
    switch (view) {
      case "gallery":
        return <MediaGallery />;
      case "albums":
        return <AlbumManager />;
      case "tree":
        return <FamilyTree onUserClick={(userId) => {
          navigate(`/profile/${userId}`);
          setView(null);
        }} />;
      default:
        return (
          <div className="space-y-8">
            {!isOwnProfile && (
              <Button
                variant="ghost"
                className="flex items-center gap-2 text-[#7c6f9f] hover:text-[#7c6f9f]/80 -ml-2"
                onClick={() => {
                  navigate("/");
                  // Set view to "tree" in HomePage
                  localStorage.setItem("homePageView", "tree");
                }}
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Family Tree
              </Button>
            )}
            <div className="grid gap-8 md:grid-cols-2">
              {/* Profile Information */}
              <Card>
                <CardHeader>
                  <CardTitle>Profile</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-lg font-medium">Display Name</h3>
                      <p className="text-muted-foreground">{displayUser.displayName}</p>
                    </div>
                    <div>
                      <h3 className="text-lg font-medium">Username</h3>
                      <p className="text-muted-foreground">{displayUser.username}</p>
                    </div>
                    {isOwnProfile && (
                      <div>
                        <h3 className="text-lg font-medium">Birthday</h3>
                        <UserProfileEditor />
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Uploaded Media */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Uploaded Media</CardTitle>
                  {uploadedMedia.length > 5 && (
                    <Link href={`/profile/${userId}/uploaded`}>
                      <Button variant="ghost">
                        See All
                      </Button>
                    </Link>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {uploadedMedia.slice(0, 5).length > 0 ? (
                      uploadedMedia.slice(0, 5).map((media) => (
                        <div
                          key={media.id}
                          className="flex items-center gap-4 p-2 rounded-lg hover:bg-accent cursor-pointer"
                          onClick={() => setSelectedMedia(media)}
                        >
                          {media.type === 'photo' && (
                            <img
                              src={media.url}
                              alt={media.title}
                              className="w-16 h-16 object-cover rounded-md"
                            />
                          )}
                          {media.type === 'post' && !media.url && (
                            <div className="w-16 h-16 bg-muted flex items-center justify-center rounded-md">
                              <span className="text-xs text-muted-foreground">Post</span>
                            </div>
                          )}
                          <div className="flex-1">
                            <h4 className="font-medium">{media.title}</h4>
                            <p className="text-sm text-muted-foreground">
                              {media.description}
                            </p>
                            {media.type === 'post' && media.website_url && (
                              <div className="mt-1 flex items-center gap-1 text-sm text-primary">
                                <Link2 className="h-3 w-3" />
                                <span>{media.website_url}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-muted-foreground">No uploaded media</p>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Tagged Media */}
              <Card className="md:col-span-2">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Tagged Media</CardTitle>
                  {taggedMedia.length > 5 && (
                    <Link href={`/profile/${userId}/tagged`}>
                      <Button variant="ghost">
                        See All
                      </Button>
                    </Link>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {taggedMedia.slice(0, 5).length > 0 ? (
                      taggedMedia.slice(0, 5).map((media) => (
                        <div
                          key={media.id}
                          className="flex items-center gap-4 p-2 rounded-lg hover:bg-accent cursor-pointer"
                          onClick={() => setSelectedMedia(media)}
                        >
                          {media.type === 'photo' && (
                            <img
                              src={media.url}
                              alt={media.title}
                              className="w-16 h-16 object-cover rounded-md"
                            />
                          )}
                          <div className="flex-1">
                            <h4 className="font-medium">{media.title}</h4>
                            <p className="text-sm text-muted-foreground">
                              {media.description}
                            </p>
                            {media.type === 'post' && media.website_url && (
                              <div className="mt-1 flex items-center gap-1 text-sm text-primary">
                                <Link2 className="h-3 w-3" />
                                <span>{media.website_url}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-muted-foreground">No tagged media</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        );
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
                  <Link href="/">
                    <Button 
                      variant={view === "gallery" ? "default" : "ghost"}
                      className="w-full"
                    >
                      Media Gallery
                    </Button>
                  </Link>
                  <Link href="/">
                    <Button 
                      variant={view === "albums" ? "default" : "ghost"}
                      className="w-full"
                    >
                      Albums
                    </Button>
                  </Link>
                  <Link href="/">
                    <Button 
                      variant={view === "tree" ? "default" : "ghost"}
                      className="w-full"
                    >
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
                <Button 
                  variant={view === "gallery" ? "default" : "ghost"}
                >
                  Media Gallery
                </Button>
              </Link>
              <Link href="/">
                <Button 
                  variant={view === "albums" ? "default" : "ghost"}
                >
                  Albums
                </Button>
              </Link>
              <Link href="/">
                <Button 
                  variant={view === "tree" ? "default" : "ghost"}
                >
                  Family Tree
                </Button>
              </Link>
              <Link href="/profile">
                <Button variant="ghost">
                  Profile
                </Button>
              </Link>
              <Button variant="outline" onClick={handleLogout}>
                Logout
              </Button>
            </nav>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {renderContent()}
      </main>

      <MediaDialog
        media={selectedMedia}
        open={!!selectedMedia}
        onOpenChange={(open) => !open && setSelectedMedia(null)}
      />
    </div>
  );
}