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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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

export default function FamilyTree({ onUserClick }: FamilyTreeProps) {
  const { user } = useUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const [selectedMember, setSelectedMember] = useState<FamilyMember | null>(null);
  const [hoveredMember, setHoveredMember] = useState<FamilyMember | null>(null);
  const [isAddingRelation, setIsAddingRelation] = useState(false);
  const [selectedRelativeMemberId, setSelectedRelativeMemberId] = useState<string>("");
  const [relationType, setRelationType] = useState<string>("");
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const svgRef = useRef<SVGSVGElement>(null);
  const [isCreatingUser, setIsCreatingUser] = useState(false);

  const form = useForm<NewUserFormData>({
    resolver: zodResolver(newUserSchema),
    defaultValues: {
      username: "",
      displayName: "",
      email: "",
      password: "",
    },
  });

  const { data: relations = [], isLoading } = useQuery<FamilyRelation[]>({
    queryKey: ["/api/family"],
    enabled: !!user,
  });

  const { data: allUsers = [] } = useQuery<FamilyMember[]>({
    queryKey: ["/api/users"],
    enabled: !!user,
  });

  const getRelationship = (hoveredMemberId: number) => {
    if (!user) return null;

    const relation = relations.find(r =>
      (r.fromUserId === user.id && r.toUserId === hoveredMemberId) ||
      (r.fromUserId === hoveredMemberId && r.toUserId === user.id)
    );

    if (!relation) return null;

    if (relation.fromUserId === user.id) {
      return relation.relationType === 'spouse'
        ? 'Your spouse'
        : `Your ${relation.relationType}`;
    } else {
      const inverseRelation = relationTypeMap[relation.relationType];
      return inverseRelation === 'spouse'
        ? 'Your spouse'
        : `Your ${inverseRelation}`;
    }
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

  const addRelationMutation = useMutation({
    mutationFn: async (data: { toUserId: number; relationType: string }) => {
      const response = await fetch("/api/family", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          inheritRelations: true
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
        description: "Family relation and inherited relationships added successfully",
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

    }
  };

  const createUserAndRelationMutation = useMutation({
    mutationFn: async (data: NewUserFormData) => {
      const userResponse = await fetch("/api/register", {
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

  if (!user) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-[400px] w-full bg-muted animate-pulse rounded-lg" />
      </div>
    );
  }

  const treeWidth = 1200;
  const treeHeight = 800;
  const nodeRadius = 40;
  const verticalSpacing = 150;
  const horizontalSpacing = 200;

  const renderTreeSvg = () => {
    const centerX = treeWidth / 2;
    const centerY = treeHeight / 2;

    const familyGroups = relations.reduce((acc, relation) => {
      const isFromUser = relation.fromUserId === user.id;
      const member = isFromUser ? relation.toUser : relation.fromUser;
      const type = isFromUser
        ? relation.relationType
        : relationTypeMap[relation.relationType as keyof typeof relationTypeMap];

      if (!acc[type]) {
        acc[type] = [];
      }
      if (!acc[type].some(m => m.id === member.id)) {
        acc[type].push(member);
      }
      return acc;
    }, {} as Record<string, FamilyMember[]>);

    const userNode = (
      <g
        key={user.id}
        transform={`translate(${centerX},${centerY})`}
        onClick={(e) => handleNodeClick(e, user.id)}
        style={{ cursor: 'pointer' }}
      >
        <circle
          r={nodeRadius}
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
          {user.displayName || user.username}
        </text>
      </g>
    );

    const memberNodes: JSX.Element[] = [];
    const relationLines: JSX.Element[] = [];
    const siblingLines: JSX.Element[] = [];

    if (familyGroups.parent) {
      const parentWidth = horizontalSpacing * (familyGroups.parent.length - 1);
      familyGroups.parent.forEach((parent, i) => {
        const x = centerX - parentWidth / 2 + i * horizontalSpacing;
        const y = centerY - verticalSpacing;

        memberNodes.push(
          <g
            key={parent.id}
            transform={`translate(${x},${y})`}
            onClick={(e) => handleNodeClick(e, parent.id)}
            style={{ cursor: 'pointer' }}
          >
            <circle
              r={nodeRadius}
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

        relationLines.push(
          <line
            key={`line-parent-${parent.id}`}
            x1={x}
            y1={y + nodeRadius}
            x2={centerX}
            y2={centerY - nodeRadius}
            stroke="hsl(var(--border))"
            strokeWidth="2"
            pointerEvents="none"
          />
        );
      });
    }

    if (familyGroups.child) {
      const childWidth = horizontalSpacing * (familyGroups.child.length - 1);
      familyGroups.child.forEach((child, i) => {
        const x = centerX - childWidth / 2 + i * horizontalSpacing;
        const y = centerY + verticalSpacing;

        memberNodes.push(
          <g
            key={child.id}
            transform={`translate(${x},${y})`}
            onClick={(e) => handleNodeClick(e, child.id)}
            style={{ cursor: 'pointer' }}
          >
            <circle
              r={nodeRadius}
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
            y1={centerY + nodeRadius}
            x2={x}
            y2={y - nodeRadius}
            stroke="hsl(var(--border))"
            strokeWidth="2"
            pointerEvents="none"
          />
        );
      });
    }

    if (familyGroups.spouse) {
      familyGroups.spouse.forEach((spouse, i) => {
        const x = centerX - horizontalSpacing;
        const y = centerY;

        memberNodes.push(
          <g
            key={spouse.id}
            transform={`translate(${x},${y})`}
            onClick={(e) => handleNodeClick(e, spouse.id)}
            style={{ cursor: 'pointer' }}
          >
            <circle
              r={nodeRadius}
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
              x1={x + nodeRadius}
              y1={y}
              x2={centerX - nodeRadius}
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

    if (familyGroups.sibling) {
      const siblingStartX = centerX + horizontalSpacing;

      familyGroups.sibling.forEach((sibling, i) => {
        const x = siblingStartX + (i * horizontalSpacing);
        const y = centerY;

        memberNodes.push(
          <g
            key={sibling.id}
            transform={`translate(${x},${y})`}
            onClick={(e) => handleNodeClick(e, sibling.id)}
            style={{ cursor: 'pointer' }}
          >
            <circle
              r={nodeRadius}
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
              x1={i === 0 ? centerX + nodeRadius : siblingStartX + ((i - 1) * horizontalSpacing) + nodeRadius}
              y1={centerY}
              x2={x - nodeRadius}
              y2={y}
              stroke="hsl(var(--border))"
              strokeWidth="2"
              pointerEvents="none"
            />
            <text
              x={(x + (i === 0 ? centerX : siblingStartX + ((i - 1) * horizontalSpacing))) / 2}
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

        if (i > 0) {
          siblingLines.push(
            <g key={`sibling-connection-${i}`}>
              <line
                x1={siblingStartX + ((i - 1) * horizontalSpacing) + nodeRadius}
                y1={centerY}
                x2={x - nodeRadius}
                y2={y}
                stroke="hsl(var(--border))"
                strokeWidth="2"
                pointerEvents="none"
              />
              <text
                x={(siblingStartX + ((i - 1) * horizontalSpacing) + x) / 2}
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
        }
      });
    }

    return (
      <svg
        width={treeWidth}
        height={treeHeight}
        className="max-w-full cursor-move"
        ref={svgRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      >
        <g transform={`translate(${position.x},${position.y})`}>
          {relationLines}
          {siblingLines}
          {memberNodes}
          {userNode}
        </g>
      </svg>
    );
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Family Tree</CardTitle>
            <CardDescription>
              Visualizing your family connections
            </CardDescription>
          </div>
          <Button onClick={() => setIsAddingRelation(true)}>
            Add Relation
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative w-full overflow-hidden border rounded-lg">
            {renderTreeSvg()}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Your Family Relationships</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {relations.map((relation) => {
                  const isFromUser = relation.fromUserId === user?.id;
                  const relatedUser = isFromUser ? relation.toUser : relation.fromUser;
                  const displayType = isFromUser
                    ? relation.relationType
                    : relationTypeMap[relation.relationType as keyof typeof relationTypeMap];

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
        </CardContent>
      </Card>

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
    </div>
  );
}