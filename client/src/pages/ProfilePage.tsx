import { useState } from "react";
import { UserProfileEditor } from "../components/UserProfileEditor";
import { useUser } from "../hooks/use-user";
import FamilyTree from "../components/FamilyTree";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AddFamilyMemberDialog } from "../components/AddFamilyMemberDialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Link, useParams, useLocation } from "wouter";
import { Menu, Link2, ArrowLeft, UserPlus2, Camera, Pencil, Trash2 } from "lucide-react";
import type { MediaItem } from "@db/schema";
import { MediaDialog } from "../components/MediaDialog";
import { MediaGallery } from "../components/MediaGallery";
import AlbumManager from "../components/AlbumManager";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import type { Memory } from "@db/schema";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";

interface ProfileUser {
  id: number;
  username: string;
  displayName?: string;
  email?: string;
  dateOfBirth?: string;
  profilePicture?: string;
  story?: string;
}

export default function ProfilePage() {
  const { user, logout } = useUser();
  const params = useParams();
  const [location, setLocation] = useLocation();
  const [selectedMedia, setSelectedMedia] = useState<MediaItem | null>(null);
  const [showAddRelationDialog, setShowAddRelationDialog] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isEditingStory, setIsEditingStory] = useState(false);
  const [storyDraft, setStoryDraft] = useState('');
  const [isAddingMemory, setIsAddingMemory] = useState(false);
  const [memoryTitle, setMemoryTitle] = useState("");
  const [memoryContent, setMemoryContent] = useState("");
  const [memoryToDelete, setMemoryToDelete] = useState<Memory | null>(null);

  const userId = params.id ? parseInt(params.id) : user?.id;
  const isOwnProfile = userId === user?.id;

  const { data: profileUser, isLoading: isLoadingProfile } = useQuery<ProfileUser>({
    queryKey: ["/api/users", userId],
    queryFn: async () => {
      const response = await fetch(`/api/users/${userId}`, {
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      return response.json();
    },
    enabled: !!userId && !isOwnProfile,
  });

  const displayUser = isOwnProfile ? user : profileUser;

  const uploadProfilePictureMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/users/profile-picture", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users", userId] });
      toast({
        title: "Success",
        description: "Profile picture updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update profile picture",
        variant: "destructive",
      });
    },
  });

  const handleProfilePictureUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "Error",
        description: "Profile picture must be less than 5MB",
        variant: "destructive",
      });
      return;
    }

    if (!file.type.startsWith('image/')) {
      toast({
        title: "Error",
        description: "Only image files are allowed",
        variant: "destructive",
      });
      return;
    }

    uploadProfilePictureMutation.mutate(file);
  };

  const { data: taggedMedia = [] } = useQuery<MediaItem[]>({
    queryKey: ["/api/media/tagged", userId],
    enabled: !!userId,
  });

  const { data: uploadedMedia = [] } = useQuery<MediaItem[]>({
    queryKey: ["/api/media", userId],
    enabled: !!userId,
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

  const { data: memories = [] } = useQuery<Memory[]>({
    queryKey: ["/api/memories", userId],
    enabled: !!userId,
  });

  const addMemoryMutation = useMutation({
    mutationFn: async (data: { title: string; content: string }) => {
      const response = await fetch('/api/memories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/memories", userId] });
      setIsAddingMemory(false);
      setMemoryTitle("");
      setMemoryContent("");
      toast({
        title: "Success",
        description: "Memory added successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteMemoryMutation = useMutation({
    mutationFn: async (memoryId: number) => {
      const response = await fetch(`/api/memories/${memoryId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/memories", userId] });
      setMemoryToDelete(null);
      toast({
        title: "Success",
        description: "Memory deleted successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (!user || ((!displayUser || isLoadingProfile) && !isOwnProfile)) {
    return null;
  }

  const calculateAge = (birthDate: string) => {
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
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
                <div className="space-y-6">
                  <div className="flex flex-col items-center space-y-4">
                    <Avatar className="h-32 w-32">
                      {displayUser?.profilePicture ? (
                        <AvatarImage src={displayUser.profilePicture} alt={displayUser.displayName || displayUser.username} />
                      ) : (
                        <AvatarFallback className="text-2xl">
                          {(displayUser?.displayName || displayUser?.username || '?').charAt(0).toUpperCase()}
                        </AvatarFallback>
                      )}
                    </Avatar>
                    {isOwnProfile && (
                      <div className="flex items-center">
                        <input
                          type="file"
                          id="profile-picture"
                          className="hidden"
                          accept="image/*"
                          onChange={handleProfilePictureUpload}
                        />
                        <label
                          htmlFor="profile-picture"
                          className="flex items-center gap-2 cursor-pointer text-sm text-primary hover:text-primary/80"
                        >
                          <Camera className="h-4 w-4" />
                          {displayUser.profilePicture ? 'Change Picture' : 'Add Picture'}
                        </label>
                      </div>
                    )}
                  </div>

                  <div className="space-y-4">
                    <div>
                      <h3 className="text-lg font-medium">Display Name</h3>
                      <p className="text-muted-foreground">
                        {displayUser?.displayName || displayUser?.username}
                      </p>
                    </div>
                    <div>
                      <h3 className="text-lg font-medium">Username</h3>
                      <p className="text-muted-foreground">{displayUser?.username}</p>
                    </div>
                    {displayUser?.email && (
                      <div>
                        <h3 className="text-lg font-medium">Email</h3>
                        <p className="text-muted-foreground">{displayUser.email}</p>
                      </div>
                    )}
                    {displayUser?.dateOfBirth && (
                      <div>
                        <h3 className="text-lg font-medium">Birthday & Age</h3>
                        <div className="text-muted-foreground">
                          <p>
                            {format(new Date(displayUser.dateOfBirth), 'MMMM d, yyyy')}
                          </p>
                          <p>
                            {calculateAge(displayUser.dateOfBirth)} years old
                          </p>
                        </div>
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
                </div>
              </CardContent>
            </Card>

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
                          <div className="space-y-1">
                            <p className="text-sm text-muted-foreground">
                              {media.description}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              Posted by {media.user?.displayName || media.user?.username}
                            </p>
                          </div>
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
          </div>

          <div className="space-y-8">
            <Card>
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

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Story</CardTitle>
                {isOwnProfile && !isEditingStory && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setIsEditingStory(true)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                {isOwnProfile && isEditingStory ? (
                  <div className="space-y-4">
                    <Textarea
                      placeholder="Share your story, milestones, or anything about yourself..."
                      value={storyDraft}
                      onChange={(e) => setStoryDraft(e.target.value)}
                      className="min-h-[200px]"
                    />
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        onClick={() => {
                          setIsEditingStory(false);
                          setStoryDraft(displayUser?.story || '');
                        }}
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={async () => {
                          try {
                            const response = await fetch('/api/users/story', {
                              method: 'POST',
                              headers: {
                                'Content-Type': 'application/json',
                              },
                              body: JSON.stringify({ story: storyDraft }),
                              credentials: 'include',
                            });

                            if (!response.ok) {
                              throw new Error(await response.text());
                            }

                            await queryClient.invalidateQueries({ queryKey: ["/api/users", userId] });
                            setIsEditingStory(false);
                            toast({
                              title: "Success",
                              description: "Your story has been updated",
                            });
                          } catch (error) {
                            toast({
                              title: "Error",
                              description: error instanceof Error ? error.message : "Failed to update story",
                              variant: "destructive",
                            });
                          }
                        }}
                      >
                        Save
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="prose prose-sm max-w-none">
                    {displayUser?.story ? (
                      <p className="whitespace-pre-wrap">{displayUser.story}</p>
                    ) : (
                      <p className="text-muted-foreground">
                        {isOwnProfile
                          ? "Share your story by clicking the edit button above..."
                          : "No story shared yet."}
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Memories</CardTitle>
                {isOwnProfile && !isAddingMemory && (
                  <Button onClick={() => setIsAddingMemory(true)}>
                    Add Memory
                  </Button>
                )}
                {memories.length > 3 && (
                  <Link href={`/profile/${userId}/memories`}>
                    <Button variant="ghost">
                      See All
                    </Button>
                  </Link>
                )}
              </CardHeader>
              <CardContent>
                {isOwnProfile && isAddingMemory ? (
                  <div className="space-y-4">
                    <Input
                      placeholder="Memory title..."
                      value={memoryTitle}
                      onChange={(e) => setMemoryTitle(e.target.value)}
                    />
                    <Textarea
                      placeholder="Share your memory..."
                      value={memoryContent}
                      onChange={(e) => setMemoryContent(e.target.value)}
                      className="min-h-[200px]"
                    />
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        onClick={() => {
                          setIsAddingMemory(false);
                          setMemoryTitle("");
                          setMemoryContent("");
                        }}
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={() => {
                          if (!memoryTitle.trim()) {
                            toast({
                              title: "Error",
                              description: "Please enter a title for your memory",
                              variant: "destructive",
                            });
                            return;
                          }
                          if (!memoryContent.trim()) {
                            toast({
                              title: "Error",
                              description: "Please enter your memory",
                              variant: "destructive",
                            });
                            return;
                          }
                          addMemoryMutation.mutate({
                            title: memoryTitle.trim(),
                            content: memoryContent.trim(),
                          });
                        }}
                      >
                        Save
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {memories.slice(0, 3).map((memory) => (
                      <Card key={memory.id}>
                        <CardHeader className="flex flex-row items-start justify-between space-y-0">
                          <div>
                            <CardTitle>{memory.title}</CardTitle>
                            <div className="space-y-1">
                              <p className="text-sm text-muted-foreground">
                                Posted by {memory.user?.displayName || memory.user?.username}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {format(new Date(memory.createdAt), 'PPP')}
                              </p>
                            </div>
                          </div>
                          {isOwnProfile && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => setMemoryToDelete(memory)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </CardHeader>
                        <CardContent>
                          <p className="whitespace-pre-wrap">{memory.content}</p>
                        </CardContent>
                      </Card>
                    ))}
                    {memories.length === 0 && (
                      <p className="text-muted-foreground">
                        {isOwnProfile
                          ? "Share your memories by clicking the Add Memory button above..."
                          : "No memories shared yet."}
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>
                  {isOwnProfile
                    ? "Your Family Tree"
                    : `${displayUser?.displayName || displayUser?.username}'s Family Tree`}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <FamilyTree
                    onUserClick={(clickedUserId) => {
                      setLocation(`/profile/${clickedUserId}`);
                    }}
                    rootUserId={userId}
                  />
                </div>
              </CardContent>
            </Card>
          </div>
          <AddFamilyMemberDialog
            open={showAddRelationDialog}
            onOpenChange={setShowAddRelationDialog}
            forUserId={userId}
          />
          <MediaDialog
            media={selectedMedia}
            open={!!selectedMedia}
            onOpenChange={(open) => !open && setSelectedMedia(null)}
          />
          <AlertDialog
            open={!!memoryToDelete}
            onOpenChange={(open) => !open && setMemoryToDelete(null)}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Memory</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete this memory? This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    if (memoryToDelete) {
                      deleteMemoryMutation.mutate(memoryToDelete.id);
                    }
                  }}
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </main>
    </div>
  );
}