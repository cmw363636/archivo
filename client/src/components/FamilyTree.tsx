import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useUser } from "../hooks/use-user";
import { useToast } from "@/hooks/use-toast";
import { Trash2, Calendar as CalendarIcon } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

type FamilyMember = {
  id: number;
  username: string;
  displayName: string;
};

type FamilyRelation = {
  id: number;
  fromUserId: number;
  toUserId: number;
  relationType: 'parent' | 'child' | 'sibling' | 'spouse';
  fromUser: FamilyMember;
  toUser: FamilyMember;
};

type FamilyTreeProps = {
  onUserClick?: (userId: number) => void;
  rootUserId?: number;
};

const relationTypeMap = {
  parent: 'child',
  child: 'parent',
  spouse: 'spouse',
  sibling: 'sibling'
} as const;

const newUserSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  displayName: z.string().min(1, "Display name is required"),
  email: z.string().email("Invalid email").optional(),
  birthday: z.date().optional(),
  password: z.string().min(6, "Password must be at least 6 characters"),
  relationType: z.enum(["parent", "child", "sibling", "spouse"], {
    required_error: "Please select a relation type",
  }),
});

type NewUserFormData = z.infer<typeof newUserSchema>;

function FamilyTree({ onUserClick, rootUserId }: FamilyTreeProps) {
  const { user } = useUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const [selectedRelativeMemberId, setSelectedRelativeMemberId] = useState<string>("");
  const [relationType, setRelationType] = useState<string>("");
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const svgRef = useRef<SVGSVGElement>(null);
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [isAddingRelation, setIsAddingRelation] = useState(false);

  // Use rootUserId if provided, otherwise fall back to logged-in user's ID
  const currentUserId = rootUserId ?? user?.id;

  const form = useForm<NewUserFormData>({
    resolver: zodResolver(newUserSchema),
    defaultValues: {
      username: "",
      displayName: "",
      email: "",
      password: "",
    },
  });

  // Query to get the root user's information
  const { data: rootUser } = useQuery<FamilyMember>({
    queryKey: ["/api/users", currentUserId],
    enabled: !!currentUserId && currentUserId !== user?.id,
  });

  // Display user is either the root user (if viewing someone else's tree) or the logged-in user
  const displayUser = rootUser ?? user;

  // Updated query to fetch relations for the specified user
  const { data: relations = [], isLoading } = useQuery<FamilyRelation[]>({
    queryKey: ["/api/family", currentUserId],
    enabled: !!currentUserId,
  });

  const { data: allUsers = [] } = useQuery<FamilyMember[]>({
    queryKey: ["/api/users"],
    enabled: !!user,
  });

  const addRelationMutation = useMutation({
    mutationFn: async (data: { toUserId: number; relationType: string }) => {
      const response = await fetch("/api/family", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(data.relationType === 'parent'
            ? { parentId: data.toUserId }
            : { toUserId: data.toUserId }),
          relationType: data.relationType,
        }),
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/family"] });
      setIsAddingRelation(false);
      setSelectedRelativeMemberId("");
      setRelationType("");
      toast({
        title: "Success",
        description: "Family relation added successfully",
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

  const deleteMutation = useMutation({
    mutationFn: async (relationId: number) => {
      const response = await fetch(`/api/family/${relationId}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/family"] });
      toast({
        title: "Success",
        description: "Relationship deleted successfully",
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

  const handleDeleteRelation = async (relationId: number) => {
    try {
      await deleteMutation.mutateAsync(relationId);
    } catch (error) {
      // Error handling is done in mutation callbacks
    }
  };

  const createUserAndRelationMutation = useMutation({
    mutationFn: async (data: NewUserFormData) => {
      const userResponse = await fetch("/api/family/create-member", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: data.username,
          password: data.password,
          displayName: data.displayName,
          email: data.email,
          birthday: data.birthday ? format(data.birthday, "yyyy-MM-dd") : undefined,
        }),
        credentials: "include",
      });

      if (!userResponse.ok) {
        throw new Error(await userResponse.text());
      }

      const { user: newUser } = await userResponse.json();

      const relationResponse = await fetch("/api/family", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toUserId: newUser.id,
          relationType: data.relationType,
          inheritRelations: true,
        }),
        credentials: "include",
      });

      if (!relationResponse.ok) {
        throw new Error(await relationResponse.text());
      }

      return relationResponse.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/family"] });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setIsAddingRelation(false);
      setIsCreatingUser(false);
      form.reset();
      toast({
        title: "Success",
        description: "New family member added successfully",
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

  const handleAddRelation = () => {
    if (isCreatingUser) {
      form.handleSubmit((data) => {
        createUserAndRelationMutation.mutate(data);
      })();
      return;
    }

    if (!selectedRelativeMemberId) {
      toast({
        title: "Error",
        description: "Please select a family member",
        variant: "destructive",
      });
      return;
    }

    if (!relationType) {
      toast({
        title: "Error",
        description: "Please select a relation type",
        variant: "destructive",
      });
      return;
    }

    const memberId = parseInt(selectedRelativeMemberId);
    if (isNaN(memberId)) {
      toast({
        title: "Error",
        description: "Invalid family member selected",
        variant: "destructive",
      });
      return;
    }

    addRelationMutation.mutate({
      toUserId: memberId,
      relationType,
    });
  };

  const getParentOfParent = (parentId: number): FamilyMember | undefined => {
    const parentRelations = relations.filter(r =>
      (r.fromUserId === parentId && r.relationType === 'child') ||
      (r.toUserId === parentId && r.relationType === 'parent')
    );

    for (const relation of parentRelations) {
      const potentialGrandparent = relation.fromUserId === parentId ? relation.toUser : relation.fromUser;
      // Skip if this is the current user
      if (potentialGrandparent.id === currentUserId) continue;
      return potentialGrandparent;
    }
    return undefined;
  };

  const renderTreeSvg = () => {
    const centerX = 2400 / 2;
    const centerY = 1600 / 2;
    const memberNodes: JSX.Element[] = [];
    const relationLines: JSX.Element[] = [];

    // Render parents and their parents (grandparents)
    if (familyGroups.parent) {
      const parentWidth = 200 * (familyGroups.parent.length - 1);
      familyGroups.parent.forEach((parent, i) => {
        const parentOfParent = getParentOfParent(parent.id);
        const x = centerX - parentWidth / 2 + i * 200;
        const y = centerY - 150;

        // Render parent's parent (grandparent) if exists
        if (parentOfParent) {
          const grandparentY = y - 150;
          memberNodes.push(
            <g
              key={parentOfParent.id}
              transform={`translate(${x},${grandparentY})`}
              onClick={(e) => handleNodeClick(e, parentOfParent.id)}
              style={{ cursor: 'pointer' }}
            >
              <circle
                r={40}
                fill="hsl(var(--secondary))"
                className="stroke-2 stroke-white"
              />
              <text
                textAnchor="middle"
                dy=".3em"
                fill="hsl(var(--secondary-foreground))"
                className="text-sm font-medium"
                pointerEvents="none"
              >
                {parentOfParent.displayName || parentOfParent.username}
              </text>
            </g>
          );

          // Draw line from grandparent to parent
          relationLines.push(
            <line
              key={`line-grandparent-${parentOfParent.id}-${parent.id}`}
              x1={x}
              y1={grandparentY + 40}
              x2={x}
              y2={y - 40}
              stroke="hsl(var(--border))"
              strokeWidth="2"
              pointerEvents="none"
            />
          );
        }

        // Render parent
        memberNodes.push(
          <g
            key={parent.id}
            transform={`translate(${x},${y})`}
            onClick={(e) => handleNodeClick(e, parent.id)}
            style={{ cursor: 'pointer' }}
          >
            <circle
              r={40}
              fill="hsl(var(--secondary))"
              className="stroke-2 stroke-white"
            />
            <text
              textAnchor="middle"
              dy=".3em"
              fill="hsl(var(--secondary-foreground))"
              className="text-sm font-medium"
              pointerEvents="none"
            >
              {parent.displayName || parent.username}
            </text>
          </g>
        );

        // Draw line from parent to user
        relationLines.push(
          <line
            key={`line-parent-${parent.id}`}
            x1={x}
            y1={y + 40}
            x2={centerX}
            y2={centerY - 40}
            stroke="hsl(var(--border))"
            strokeWidth="2"
            pointerEvents="none"
          />
        );
      });
    }

    // Render children
    if (familyGroups.child) {
      const childWidth = 200 * (familyGroups.child.length - 1);
      familyGroups.child.forEach((child, i) => {
        const x = centerX - childWidth / 2 + i * 200;
        const y = centerY + 150;

        memberNodes.push(
          <g
            key={child.id}
            transform={`translate(${x},${y})`}
            onClick={(e) => handleNodeClick(e, child.id)}
            style={{ cursor: 'pointer' }}
          >
            <circle
              r={40}
              fill="hsl(var(--secondary))"
              className="stroke-2 stroke-white"
            />
            <text
              textAnchor="middle"
              dy=".3em"
              fill="hsl(var(--secondary-foreground))"
              className="text-sm font-medium"
              pointerEvents="none"
            >
              {child.displayName || child.username}
            </text>
          </g>
        );

        relationLines.push(
          <line
            key={`line-child-${child.id}`}
            x1={centerX}
            y1={centerY + 40}
            x2={x}
            y2={y - 40}
            stroke="hsl(var(--border))"
            strokeWidth="2"
            pointerEvents="none"
          />
        );
      });
    }

    // Render spouse
    if (familyGroups.spouse) {
      familyGroups.spouse.forEach((spouse, i) => {
        const x = centerX - 200;
        const y = centerY;

        memberNodes.push(
          <g
            key={spouse.id}
            transform={`translate(${x},${y})`}
            onClick={(e) => handleNodeClick(e, spouse.id)}
            style={{ cursor: 'pointer' }}
          >
            <circle
              r={40}
              fill="hsl(var(--secondary))"
              className="stroke-2 stroke-white"
            />
            <text
              textAnchor="middle"
              dy=".3em"
              fill="hsl(var(--secondary-foreground))"
              className="text-sm font-medium"
              pointerEvents="none"
            >
              {spouse.displayName || spouse.username}
            </text>
          </g>
        );

        relationLines.push(
          <g key={`line-spouse-${spouse.id}`}>
            <line
              x1={x + 40}
              y1={y}
              x2={centerX - 40}
              y2={centerY}
              stroke="hsl(var(--border))"
              strokeWidth="2"
              pointerEvents="none"
            />
            <text
              x={(x + centerX) / 2}
              y={y - 10}
              textAnchor="middle"
              fill="hsl(var(--muted-foreground))"
              className="text-xs"
              pointerEvents="none"
            >
              Spouse
            </text>
          </g>
        );
      });
    }

    // Render siblings
    if (familyGroups.sibling) {
      const siblingStartX = centerX + 200;

      familyGroups.sibling.forEach((sibling, i) => {
        const x = siblingStartX + (i * 200);
        const y = centerY;

        memberNodes.push(
          <g
            key={sibling.id}
            transform={`translate(${x},${y})`}
            onClick={(e) => handleNodeClick(e, sibling.id)}
            style={{ cursor: 'pointer' }}
          >
            <circle
              r={40}
              fill="hsl(var(--secondary))"
              className="stroke-2 stroke-white"
            />
            <text
              textAnchor="middle"
              dy=".3em"
              fill="hsl(var(--secondary-foreground))"
              className="text-sm font-medium"
              pointerEvents="none"
            >
              {sibling.displayName || sibling.username}
            </text>
          </g>
        );

        relationLines.push(
          <g key={`line-sibling-${sibling.id}`}>
            <line
              x1={i === 0 ? centerX + 40 : siblingStartX + ((i - 1) * 200) + 40}
              y1={centerY}
              x2={x - 40}
              y2={y}
              stroke="hsl(var(--border))"
              strokeWidth="2"
              pointerEvents="none"
            />
            <text
              x={(x + (i === 0 ? centerX : siblingStartX + ((i - 1) * 200))) / 2}
              y={y - 10}
              textAnchor="middle"
              fill="hsl(var(--muted-foreground))"
              className="text-xs"
              pointerEvents="none"
            >
              Sibling
            </text>
          </g>
        );
      });
    }

    return (
      <svg
        width={2400}
        height={1600}
        className="max-w-full cursor-move"
        ref={svgRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      >
        <g transform={`translate(${position.x},${position.y})`}>
          {relationLines}
          {memberNodes}
          {/* Center user node */}
          <g
            key={displayUser?.id}
            transform={`translate(${centerX},${centerY})`}
            onClick={(e) => handleNodeClick(e, displayUser?.id)}
            style={{ cursor: 'pointer' }}
          >
            <circle
              r={40}
              fill="hsl(var(--primary))"
              className="stroke-2 stroke-white"
            />
            <text
              textAnchor="middle"
              dy=".3em"
              fill="white"
              className="text-sm font-medium"
              pointerEvents="none"
            >
              {displayUser?.displayName || displayUser?.username}
            </text>
          </g>
        </g>
      </svg>
    );
  };

  const handleMouseDown = (event: React.MouseEvent) => {
    if (event.button !== 0) return;
    setIsDragging(true);
    setDragStart({
      x: event.clientX - position.x,
      y: event.clientY - position.y
    });
  };

  const handleMouseMove = (event: React.MouseEvent) => {
    if (!isDragging) return;
    const newX = event.clientX - dragStart.x;
    const newY = event.clientY - dragStart.y;
    setPosition({ x: newX, y: newY });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
  };

  const handleNodeClick = (event: React.MouseEvent, userId: number) => {
    event.stopPropagation();
    event.preventDefault();
    if (!isDragging && onUserClick) {
      onUserClick(userId);
    } else if (!isDragging) {
      navigate(`/profile/${userId}`);
    }
  };


  if (!currentUserId) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-[400px] w-full bg-muted animate-pulse rounded-lg" />
      </div>
    );
  }

  // Update family groups to use currentUserId instead of user.id
  const familyGroups = relations.reduce((acc, relation) => {
    const isFromUser = relation.fromUserId === currentUserId;
    const member = isFromUser ? relation.toUser : relation.fromUser;
    const relationType = isFromUser
      ? relation.relationType
      : relationTypeMap[relation.relationType];

    if (!acc[relationType]) {
      acc[relationType] = [];
    }

    if (!acc[relationType].some(m => m.id === member.id)) {
      acc[relationType].push(member);
    }

    return acc;
  }, {} as Record<string, FamilyMember[]>);

  // Only show the add relation button if viewing own tree
  const isOwnTree = currentUserId === user?.id;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Family Tree</CardTitle>
            <CardDescription>
              Visualizing family connections
            </CardDescription>
          </div>
          {isOwnTree && (
            <Button onClick={() => setIsAddingRelation(true)}>
              Add Relation
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative w-full overflow-hidden border rounded-lg">
            {renderTreeSvg()}
          </div>

          {isOwnTree && (
            <Card>
              <CardHeader>
                <CardTitle>Your Family Relationships</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {relations.map((relation) => {
                    const isFromUser = relation.fromUserId === currentUserId;
                    const relatedUser = isFromUser ? relation.toUser : relation.fromUser;
                    const displayType = isFromUser
                      ? relation.relationType
                      : relationTypeMap[relation.relationType];

                    return (
                      <li key={relation.id} className="flex items-center justify-between">
                        <span className="text-sm">
                          <Link href={`/profile/${relatedUser.id}`} className="font-medium hover:underline">
                            {relatedUser.displayName || relatedUser.username}
                          </Link>
                          {' is your '}
                          <span className="font-medium">{displayType}</span>
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteRelation(relation.id)}
                          className="h-8 w-8 p-0"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>

      {/* Add Relation Dialog */}
      {isOwnTree && (
        <Dialog
          open={isAddingRelation}
          onOpenChange={(open) => {
            setIsAddingRelation(open);
            if (!open) {
              setSelectedRelativeMemberId("");
              setRelationType("");
              setIsCreatingUser(false);
              form.reset();
            }
          }}
        >
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Add Family Relation</DialogTitle>
              <DialogDescription>
                Select an existing family member or create a new one
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              <div className="flex items-center gap-4">
                <Button
                  type="button"
                  variant={!isCreatingUser ? "default" : "outline"}
                  onClick={() => setIsCreatingUser(false)}
                  className="flex-1"
                >
                  Existing Member
                </Button>
                <Button
                  type="button"
                  variant={isCreatingUser ? "default" : "outline"}
                  onClick={() => setIsCreatingUser(true)}
                  className="flex-1"
                >
                  New Member
                </Button>
              </div>

              {isCreatingUser ? (
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(handleAddRelation)} className="space-y-4">
                    <FormField
                      control={form.control}
                      name="username"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Username</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="displayName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Display Name</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email (Optional)</FormLabel>
                          <FormControl>
                            <Input type="email" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Password</FormLabel>
                          <FormControl>
                            <Input type="password" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="birthday"
                      render={({ field }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel>Birthday (Optional)</FormLabel>
                          <Popover>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant={"outline"}
                                  className={cn(
                                    "w-full pl-3 text-left font-normal",
                                    !field.value && "text-muted-foreground"
                                  )}
                                >
                                  {field.value ? (
                                    format(field.value, "PPP")
                                  ) : (
                                    <span>Pick a date</span>
                                  )}
                                  <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                mode="single"
                                selected={field.value}
                                onSelect={field.onChange}
                                disabled={(date) =>
                                  date > new Date() || date < new Date("1900-01-01")
                                }
                                initialFocus
                              />
                            </PopoverContent>
                          </Popover>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="relationType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Relation Type</FormLabel>
                          <Select
                            value={field.value}
                            onValueChange={field.onChange}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select relation type" />
                            </SelectTrigger>
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

                    <Button type="submit" className="w-full">
                      Create Member
                    </Button>
                  </form>
                </Form>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Select Member</label>
                    <Select
                      value={selectedRelativeMemberId}
                      onValueChange={setSelectedRelativeMemberId}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a family member" />
                      </SelectTrigger>
                      <SelectContent>
                        {allUsers
                          .filter((u) => u.id !== user?.id)
                          .map((user) => (
                            <SelectItem key={user.id} value={user.id.toString()}>
                              {user.displayName || user.username}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Relation Type</label>
                    <Select
                      value={relationType}
                      onValueChange={setRelationType}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select relation type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="parent">Parent</SelectItem>
                        <SelectItem value="child">Child</SelectItem>
                        <SelectItem value="sibling">Sibling</SelectItem>
                        <SelectItem value="spouse">Spouse</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <Button
                    className="w-full"
                    disabled={!selectedRelativeMemberId || !relationType}
                    onClick={handleAddRelation}
                  >
                    Add Relation
                  </Button>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

export default FamilyTree;