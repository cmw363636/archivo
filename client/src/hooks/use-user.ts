import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { InsertUser, User } from "@db/schema";
import { useToast } from "@/hooks/use-toast";

type LoginResponse = {
  message: string;
  user: User;
};

export function useUser() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: user, isLoading } = useQuery<User>({
    queryKey: ['/api/user'],
    queryFn: async () => {
      const response = await fetch('/api/user', {
        credentials: 'include',
      });

      if (!response.ok) {
        if (response.status === 401) {
          return null;
        }
        throw new Error(await response.text());
      }

      return response.json();
    },
    retry: false,
  });

  const loginMutation = useMutation({
    mutationFn: async (credentials: InsertUser) => {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials),
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      return response.json() as Promise<LoginResponse>;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['/api/user'], data.user);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/logout', {
        method: 'POST',
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Logout failed');
      }
    },
    onSuccess: () => {
      queryClient.setQueryData(['/api/user'], null);
      toast({
        title: "Success",
        description: "Logged out successfully",
      });
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (userData: InsertUser) => {
      const response = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData),
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      return response.json() as Promise<LoginResponse>;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['/api/user'], data.user);
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
    user,
    isLoading,
    login: loginMutation.mutateAsync,
    logout: logoutMutation.mutateAsync,
    register: registerMutation.mutateAsync,
  };
}