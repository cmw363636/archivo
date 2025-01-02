import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2 } from "lucide-react";

// Schema for adding a new relation
const addRelationSchema = z.object({
  relationType: z.enum(["parent", "child", "sibling", "spouse"]),
  existingUserId: z.number().optional(),
  newUser: z
    .object({
      username: z.string().min(1, "Username is required"),
      displayName: z.string().optional(),
      password: z.string().min(6, "Password must be at least 6 characters"),
      email: z.string().email("Invalid email").optional().nullable(),
      birthday: z.string().optional().nullable(),
    })
    .optional(),
});

type AddRelationFormValues = z.infer<typeof addRelationSchema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  forUserId: number;
}

export function AddFamilyMemberDialog({ open, onOpenChange, forUserId }: Props) {
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<AddRelationFormValues>({
    resolver: zodResolver(addRelationSchema),
    defaultValues: {
      relationType: "parent",
    },
  });

  const addRelationMutation = useMutation({
    mutationFn: async (values: AddRelationFormValues) => {
      let toUserId: number;

      // If creating a new user, create them first
      if (mode === "new" && values.newUser) {
        const registerResponse = await fetch("/api/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(values.newUser),
          credentials: "include",
        });

        if (!registerResponse.ok) {
          throw new Error(await registerResponse.text());
        }

        const registerData = await registerResponse.json();
        toUserId = registerData.user.id;
      } else if (mode === "existing" && values.existingUserId) {
        toUserId = values.existingUserId;
      } else {
        throw new Error("Either a new user or existing user ID must be provided");
      }

      // Now create the family relation
      const relationResponse = await fetch("/api/family", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromUserId: forUserId,
          toUserId: toUserId,
          relationType: values.relationType,
        }),
        credentials: "include",
      });

      if (!relationResponse.ok) {
        throw new Error(await relationResponse.text());
      }

      return relationResponse.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/family", forUserId] });
      onOpenChange(false);
      form.reset();
      toast({
        title: "Success",
        description: "Family member added successfully",
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

  const onSubmit = async (values: AddRelationFormValues) => {
    if (mode === "existing" && !values.existingUserId) {
      toast({
        title: "Error",
        description: "Please select a user",
        variant: "destructive",
      });
      return;
    }

    if (mode === "new" && !values.newUser) {
      toast({
        title: "Error",
        description: "Please fill in the new user details",
        variant: "destructive",
      });
      return;
    }

    await addRelationMutation.mutateAsync(values);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Family Member</DialogTitle>
          <DialogDescription>
            Add a new family member by selecting their relation type and either choosing an existing user or creating a new one.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Relation Type - Always visible */}
            <FormField
              control={form.control}
              name="relationType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Relation Type</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select relation type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="parent">Parent</SelectItem>
                      <SelectItem value="child">Child</SelectItem>
                      <SelectItem value="sibling">Sibling</SelectItem>
                      <SelectItem value="spouse">Spouse</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Tabs value={mode} onValueChange={(v) => setMode(v as "existing" | "new")} className="pt-2">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="existing">Existing User</TabsTrigger>
                <TabsTrigger value="new">New User</TabsTrigger>
              </TabsList>

              <TabsContent value="existing">
                <FormField
                  control={form.control}
                  name="existingUserId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Select User</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="Enter user ID"
                          {...field}
                          onChange={(e) =>
                            field.onChange(e.target.value ? parseInt(e.target.value) : undefined)
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </TabsContent>

              <TabsContent value="new" className="space-y-4">
                <FormField
                  control={form.control}
                  name="newUser.username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Username</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter username" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="newUser.displayName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Display Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter display name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="newUser.email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email (optional)</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="Enter email"
                          {...field}
                          value={field.value ?? ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="newUser.birthday"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Birthday (optional)</FormLabel>
                      <FormControl>
                        <Input
                          type="date"
                          {...field}
                          value={field.value ?? ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="newUser.password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder="Enter password"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </TabsContent>
            </Tabs>

            <Button
              type="submit"
              className="w-full"
              disabled={addRelationMutation.isPending}
            >
              {addRelationMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Adding Family Member...
                </>
              ) : (
                "Add Family Member"
              )}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}