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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { User } from "@db/schema";

interface TagUsersProps {
  mediaId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function TagUsers({ mediaId, open, onOpenChange }: TagUsersProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedUserId, setSelectedUserId] = useState<string>("");

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const { data: existingTags = [] } = useQuery<Array<{ userId: number; user: User }>>({
    queryKey: [`/api/media/${mediaId}/tags`],
    enabled: !!mediaId,
  });

  const tagMutation = useMutation({
    mutationFn: async ({ userId }: { userId: number }) => {
      const response = await fetch(`/api/media/${mediaId}/tags`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/media/${mediaId}/tags`] });
      queryClient.invalidateQueries({ queryKey: ["/api/media"] });
      toast({
        title: "Success",
        description: "User tagged successfully",
      });
      setSelectedUserId("");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const removeTagMutation = useMutation({
    mutationFn: async ({ userId }: { userId: number }) => {
      const response = await fetch(`/api/media/${mediaId}/tags/${userId}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/media/${mediaId}/tags`] });
      queryClient.invalidateQueries({ queryKey: ["/api/media"] });
      toast({
        title: "Success",
        description: "Tag removed successfully",
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

  const handleTagUser = () => {
    if (!selectedUserId) return;
    tagMutation.mutate({ userId: parseInt(selectedUserId) });
  };

  const handleRemoveTag = (userId: number) => {
    removeTagMutation.mutate({ userId });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Tag Users</DialogTitle>
          <DialogDescription>
            Tag family members in this media item
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Select
              value={selectedUserId}
              onValueChange={setSelectedUserId}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a user to tag" />
              </SelectTrigger>
              <SelectContent>
                {users
                  .filter(
                    (user) =>
                      !existingTags.some((tag) => tag.userId === user.id)
                  )
                  .map((user) => (
                    <SelectItem key={user.id} value={user.id.toString()}>
                      {user.displayName || user.username}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <Button
              className="w-full"
              disabled={!selectedUserId}
              onClick={handleTagUser}
            >
              Tag User
            </Button>
          </div>

          {existingTags.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-medium">Tagged Users</h4>
              <div className="space-y-2">
                {existingTags.map((tag) => (
                  <div
                    key={tag.userId}
                    className="flex items-center justify-between p-2 bg-muted rounded-lg"
                  >
                    <span>{tag.user.displayName || tag.user.username}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveTag(tag.userId)}
                    >
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
