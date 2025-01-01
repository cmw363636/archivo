import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

export type MediaItem = {
  id: number;
  userId: number;
  albumId: number | null;
  type: string;
  title: string;
  description: string | null;
  url: string;
  website_url?: string | null;
  content?: string | null;
  metadata: any;
  createdAt: string;
};

export function useMedia(albumId?: number) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: mediaItems = [], isLoading } = useQuery<MediaItem[]>({
    queryKey: albumId ? ["/api/media", albumId] : ["/api/media"],
    queryFn: async ({ queryKey }) => {
      const url = albumId ? `/api/media?albumId=${albumId}` : '/api/media';
      const res = await fetch(url, {
        credentials: "include",
      });

      if (!res.ok) {
        if (res.status >= 500) {
          throw new Error(`${res.status}: ${res.statusText}`);
        }

        throw new Error(`${res.status}: ${await res.text()}`);
      }

      return res.json();
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      // Validate file size before upload
      const file = formData.get('file') as File;
      if (file && file.size > 50 * 1024 * 1024) {
        throw new Error('File size must be less than 50MB');
      }

      try {
        const response = await fetch("/api/media", {
          method: "POST",
          body: formData,
          credentials: "include",
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(errorText || 'Upload failed');
        }

        return response.json();
      } catch (error) {
        if (error instanceof Error) {
          throw error;
        }
        throw new Error('Upload failed. Please try again.');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/media"] });
      if (albumId) {
        queryClient.invalidateQueries({ queryKey: ["/api/media", albumId] });
      }
      toast({
        title: "Success",
        description: "Media uploaded successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Upload Failed",
        description: error.message || "Failed to upload media. Please try again.",
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