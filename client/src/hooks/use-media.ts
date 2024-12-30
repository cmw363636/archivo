import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

export type MediaItem = {
  id: number;
  userId: number;
  type: string;
  title: string;
  description: string | null;
  url: string;
  metadata: any;
  createdAt: string;
};

export function useMedia() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: mediaItems = [], isLoading } = useQuery<MediaItem[]>({
    queryKey: ["/api/media"],
  });

  const uploadMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await fetch("/api/media", {
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
      queryClient.invalidateQueries({ queryKey: ["/api/media"] });
      toast({
        title: "Success",
        description: "Media uploaded successfully",
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

  return {
    mediaItems,
    isLoading,
    upload: uploadMutation.mutate,
    isUploading: uploadMutation.isPending,
  };
}
