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
  relationType: z.enum(["Parent", "Child", "Sibling", "Spouse"]),
  existingUserId: z.number().optional(),
  newUser: z
    .object({
      username: z.string().min(1, "Username is required"),
      displayName: z.string().optional(),
      password: z.string().min(6, "Password must be at least 6 characters"),
      email: z.string().email("Invalid email").optional(),
      birthday: z.string().optional(),
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
      relationType: "Parent",
    },
  });

  const addRelationMutation = useMutation({
    mutationFn: async (values: AddRelationFormValues) => {
      const response = await fetch("/api/family", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...values,
          userId: forUserId,
        }),
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      return response.json();
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
            {/* Relation Type - Always visible regardless of mode */}
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
                      <SelectItem value="Parent">Parent</SelectItem>
                      <SelectItem value="Child">Child</SelectItem>
                      <SelectItem value="Sibling">Sibling</SelectItem>
                      <SelectItem value="Spouse">Spouse</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Tabs value={mode} onValueChange={(v) => setMode(v as "existing" | "new")}>
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

              <TabsContent value="new">
                <div className="space-y-4">
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
                </div>
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