import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Users, Image, Eye } from "lucide-react";
import type { User } from "@db/schema";
import { MediaGallery } from "./MediaGallery";

type Album = {
  id: number;
  name: string;
  description: string | null;
  createdBy: number;
  createdAt: string;
  isShared: boolean;
  mediaItems?: Array<{
    id: number;
    title: string;
    type: string;
    url: string;
  }>;
  members?: Array<{
    userId: number;
    canEdit: boolean;
    user?: {
      username: string;
      displayName: string;
    };
  }>;
};

type NewMemberData = {
  userId: number | null;
  canEdit: boolean;
};

export default function AlbumManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [selectedAlbum, setSelectedAlbum] = useState<Album | null>(null);
  const [newAlbumData, setNewAlbumData] = useState({
    name: "",
    description: "",
    isShared: false,
  });
  const [newMemberData, setNewMemberData] = useState<NewMemberData>({
    userId: null,
    canEdit: false,
  });

  const { data: albums = [], isLoading } = useQuery<Album[]>({
    queryKey: ["/api/albums"],
  });

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const createAlbumMutation = useMutation({
    mutationFn: async (data: typeof newAlbumData) => {
      const response = await fetch("/api/albums", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/albums"] });
      setIsCreateOpen(false);
      setNewAlbumData({ name: "", description: "", isShared: false });
      toast({
        title: "Success",
        description: "Album created successfully",
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

  const addMemberMutation = useMutation({
    mutationFn: async ({
      albumId,
      data,
    }: {
      albumId: number;
      data: { userId: number; canEdit: boolean };
    }) => {
      const response = await fetch(`/api/albums/${albumId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/albums"] });
      setIsAddMemberOpen(false);
      setNewMemberData({ userId: null, canEdit: false });
      toast({
        title: "Success",
        description: "Member added successfully",
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

  const handleCreateAlbum = (e: React.FormEvent) => {
    e.preventDefault();
    createAlbumMutation.mutate(newAlbumData);
  };

  const handleAddMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAlbum || !newMemberData.userId) return;

    addMemberMutation.mutate({
      albumId: selectedAlbum.id,
      data: {
        userId: newMemberData.userId,
        canEdit: newMemberData.canEdit,
      },
    });
  };

  const handleViewAlbum = (album: Album) => {
    setSelectedAlbum(album);
    setIsViewOpen(true);
  };

  if (isLoading) {
    return <div>Loading albums...</div>;
  }

  const getCreatorName = (albumCreatorId: number) => {
    const creator = users.find(user => user.id === albumCreatorId);
    return creator?.displayName || creator?.username || 'Unknown User';
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Albums</h2>
        <Button onClick={() => setIsCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Album
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {albums.map((album) => (
          <Card key={album.id}>
            <CardHeader>
              <CardTitle>{album.name}</CardTitle>
              <CardDescription>
                Created by {getCreatorName(album.createdBy)}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {album.description && (
                <p className="text-sm text-muted-foreground mb-4">
                  {album.description}
                </p>
              )}
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Image className="h-4 w-4" />
                  {(album.mediaItems?.length || 0)} items
                </div>
                <div className="flex items-center gap-1">
                  <Users className="h-4 w-4" />
                  {(album.members?.length || 0) + 1} members
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex gap-2">
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  setSelectedAlbum(album);
                  setIsAddMemberOpen(true);
                }}
              >
                Add Member
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => handleViewAlbum(album)}
              >
                <Eye className="h-4 w-4 mr-2" />
                View
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>

      {/* Create Album Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Album</DialogTitle>
            <DialogDescription>
              Create a new album to organize and share your media
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateAlbum} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={newAlbumData.name}
                onChange={(e) =>
                  setNewAlbumData({ ...newAlbumData, name: e.target.value })
                }
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={newAlbumData.description}
                onChange={(e) =>
                  setNewAlbumData({
                    ...newAlbumData,
                    description: e.target.value,
                  })
                }
              />
            </div>
            <Button type="submit" className="w-full">
              Create Album
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add Member Dialog */}
      <Dialog
        open={isAddMemberOpen}
        onOpenChange={(open) => {
          setIsAddMemberOpen(open);
          if (!open) {
            setSelectedAlbum(null);
            setNewMemberData({ userId: null, canEdit: false });
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Member to Album</DialogTitle>
            <DialogDescription>
              Add a family member to {selectedAlbum?.name}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddMember} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="userId">Select Member</Label>
              <Select
                value={newMemberData.userId?.toString() || ""}
                onValueChange={(value) =>
                  setNewMemberData({ ...newMemberData, userId: parseInt(value, 10) })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a member" />
                </SelectTrigger>
                <SelectContent>
                  {users
                    .filter((user) => {
                      if (!selectedAlbum) return false;
                      return (
                        user.id !== selectedAlbum.createdBy &&
                        !selectedAlbum.members?.some(
                          (member) => member.userId === user.id
                        )
                      );
                    })
                    .map((user) => (
                      <SelectItem
                        key={user.id}
                        value={user.id.toString()}
                      >
                        {user.displayName || user.username}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={!newMemberData.userId}
            >
              Add Member
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* View Album Dialog */}
      <Dialog 
        open={isViewOpen} 
        onOpenChange={(open) => {
          setIsViewOpen(open);
          if (!open) {
            setSelectedAlbum(null);
          }
        }}
      >
        <DialogContent className="max-w-5xl h-[80vh]">
          <DialogHeader>
            <DialogTitle>{selectedAlbum?.name}</DialogTitle>
            <DialogDescription>
              {selectedAlbum?.description}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto">
            {selectedAlbum && (
              <MediaGallery albumId={selectedAlbum.id} />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}