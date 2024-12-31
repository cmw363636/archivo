import { useState } from "react";
import { useUser } from "../hooks/use-user";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format, isValid, parse } from "date-fns";
import { User } from "@db/schema";

export function UserProfileEditor() {
  const { user } = useUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [dateInput, setDateInput] = useState(
    user?.dateOfBirth ? format(new Date(user.dateOfBirth), "yyyy-MM-dd") : ""
  );

  const updateMutation = useMutation({
    mutationFn: async (data: Partial<User>) => {
      const response = await fetch("/api/user/profile", {
        method: "PATCH",
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
      queryClient.invalidateQueries({ queryKey: ["user"] });
      setIsOpen(false);
      toast({
        title: "Success",
        description: "Birthday updated successfully",
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Parse the date from the input
    const parsedDate = parse(dateInput, "yyyy-MM-dd", new Date());

    if (!isValid(parsedDate)) {
      toast({
        title: "Error",
        description: "Please enter a valid date in YYYY-MM-DD format",
        variant: "destructive",
      });
      return;
    }

    updateMutation.mutate({
      dateOfBirth: parsedDate.toISOString(),
    });
  };

  // Calculate age
  const calculateAge = (birthDate: Date) => {
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          {user?.dateOfBirth ? (
            <>
              {format(new Date(user.dateOfBirth), "PP")} (Age:{" "}
              {calculateAge(new Date(user.dateOfBirth))})
            </>
          ) : (
            "Set Birthday"
          )}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Update Birthday</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Date of Birth (YYYY-MM-DD)</Label>
            <Input
              type="text"
              placeholder="1987-01-01"
              value={dateInput}
              onChange={(e) => setDateInput(e.target.value)}
              pattern="\d{4}-\d{2}-\d{2}"
              title="Please enter date in YYYY-MM-DD format"
            />
            <p className="text-sm text-muted-foreground">
              Enter your birth date in YYYY-MM-DD format (e.g., 1987-01-01)
            </p>
          </div>
          <Button type="submit" className="w-full">
            Save
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}