import { useState } from "react";
import { UserProfileEditor } from "../components/UserProfileEditor";
import { useUser } from "../hooks/use-user";
import FamilyTree from "../components/FamilyTree";
import { useQuery } from "@tanstack/react-query";
import { AddFamilyMemberDialog } from "../components/AddFamilyMemberDialog";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Link, useParams, useLocation } from "wouter";
import { Menu, Link2, ArrowLeft, UserPlus2 } from "lucide-react";
import type { MediaItem } from "@db/schema";
import { MediaDialog } from "../components/MediaDialog";
import { MediaGallery } from "../components/MediaGallery";
import AlbumManager from "../components/AlbumManager";

interface ProfileUser {
  id: number;
  username: string;
  displayName?: string;
  email?: string;
}

interface FamilyRelation {
  id: number;
  relationType: string;
  toUser: ProfileUser;
}

export default function ProfilePage() {
  const { user, logout } = useUser();
  const params = useParams();
  const [location, setLocation] = useLocation();
  const [selectedMedia, setSelectedMedia] = useState<MediaItem | null>(null);
  const [showAddRelationDialog, setShowAddRelationDialog] = useState(false);

  const userId = params.id ? parseInt(params.id) : user?.id;
  const isOwnProfile = userId === user?.id;

  const { data: profileUser } = useQuery<ProfileUser>({
    queryKey: ["/api/users", userId],
    enabled: !!userId && !isOwnProfile,
  });

  const displayUser = isOwnProfile ? user : profileUser;

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

  const { data: familyRelations = [] } = useQuery<FamilyRelation[]>({
    queryKey: ["/api/family", userId],
    enabled: !!userId && !isOwnProfile,
  });

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const handleAddRelation = () => {
    setShowAddRelationDialog(true);
  };

  if (!user || !displayUser) {
    return null;
  }

  const renderContent = () => {
    if (location === "/") {
      return <MediaGallery />;
    }
    if (location === "/albums") {
      return <AlbumManager />;
    }
    if (location === "/family") {
      return (
        <FamilyTree
          onUserClick={(userId) => {
            setLocation(`/profile/${userId}`);
          }}
        />
      );
    }

    return (
      <div className="space-y-8">
        {!isOwnProfile && (
          <Button
            variant="ghost"
            className="flex items-center gap-2 text-[#7c6f9f] hover:text-[#7c6f9f]/80 -ml-2"
            onClick={() => setLocation("/family")}
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Family Tree
          </Button>
        )}
        <div className="grid gap-8 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Profile</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-medium">Display Name</h3>
                  <p className="text-muted-foreground">
                    {displayUser.displayName || displayUser.username}
                  </p>
                </div>
                <div>
                  <h3 className="text-lg font-medium">Username</h3>
                  <p className="text-muted-foreground">{displayUser.username}</p>
                </div>
                {displayUser.email && (
                  <div>
                    <h3 className="text-lg font-medium">Email</h3>
                    <p className="text-muted-foreground">{displayUser.email}</p>
                  </div>
                )}
                {isOwnProfile && (
                  <UserProfileEditor />
                )}
                {!isOwnProfile && (
                  <div className="pt-4">
                    <Button
                      onClick={handleAddRelation}
                      className="w-full flex items-center gap-2"
                    >
                      <UserPlus2 className="h-4 w-4" />
                      Add Relation
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {!isOwnProfile && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Family Relations</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {familyRelations.length > 0 ? (
                    familyRelations.map((relation) => (
                      <div
                        key={relation.id}
                        className="flex items-center justify-between p-2 rounded-lg hover:bg-accent"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-medium">
                            {relation.relationType}
                          </span>
                          <span className="text-muted-foreground">
                            {relation.toUser?.displayName || relation.toUser?.username}
                          </span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-muted-foreground">No family relations</p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

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
                      {media.type === 'photo' && media.url && (
                        <img
                          src={media.url}
                          alt={media.title || ''}
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
                      {media.type === 'photo' && media.url && (
                        <img
                          src={media.url}
                          alt={media.title || ''}
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
                    variant={location === "/" ? "default" : "ghost"}
                    className="w-full"
                    onClick={() => setLocation("/")}
                  >
                    Media Gallery
                  </Button>
                  <Button
                    variant={location === "/albums" ? "default" : "ghost"}
                    className="w-full"
                    onClick={() => setLocation("/albums")}
                  >
                    Albums
                  </Button>
                  <Button
                    variant={location === "/family" ? "default" : "ghost"}
                    className="w-full"
                    onClick={() => setLocation("/family")}
                  >
                    Family Tree
                  </Button>
                  <Link href="/profile">
                    <Button
                      variant={location === "/profile" || (location.startsWith("/profile/") && isOwnProfile) ? "default" : "ghost"}
                      className="w-full"
                    >
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
                variant={location === "/" ? "default" : "ghost"}
                onClick={() => setLocation("/")}
              >
                Media Gallery
              </Button>
              <Button
                variant={location === "/albums" ? "default" : "ghost"}
                onClick={() => setLocation("/albums")}
              >
                Albums
              </Button>
              <Button
                variant={location === "/family" ? "default" : "ghost"}
                onClick={() => setLocation("/family")}
              >
                Family Tree
              </Button>
              <Link href="/profile">
                <Button
                  variant={location === "/profile" || (location.startsWith("/profile/") && isOwnProfile) ? "default" : "ghost"}
                >
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

      {showAddRelationDialog && (
        <AddFamilyMemberDialog
          open={showAddRelationDialog}
          onOpenChange={setShowAddRelationDialog}
          forUserId={userId}
        />
      )}

      <MediaDialog
        media={selectedMedia}
        open={!!selectedMedia}
        onOpenChange={(open) => !open && setSelectedMedia(null)}
      />
    </div>
  );
}