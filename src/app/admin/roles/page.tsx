"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ALL_PERMISSIONS } from "@/lib/constants";
import { ErrorState } from "@/components/ui/error-state";
import { fetchJson, fetchList, errorMessage } from "@/lib/fetch-json";
import { memberDisplayLabel } from "@/lib/utils";
import { toast } from "sonner";

interface AdminRole { id: string; name: string; permissions: string[]; }
interface AdminUser {
  id: string;
  discordId: string;
  discordName: string;
  roles: AdminRole[];
  extraPermissions: string[];
}
interface RosterMember { id: string; name: string; callSign?: string | null; rank: string; discordId?: string | null; }

function PermissionChecklist({
  selected,
  onToggle,
}: {
  selected: string[];
  onToggle: (permission: string, checked: boolean) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto">
      {ALL_PERMISSIONS.map((p) => (
        <label key={p} className="flex items-center gap-2 text-xs text-gray-300">
          <input
            type="checkbox"
            checked={selected.includes(p)}
            onChange={(e) => onToggle(p, e.target.checked)}
          />
          {p}
        </label>
      ))}
    </div>
  );
}

export default function AdminRolesPage() {
  const [roles, setRoles] = useState<AdminRole[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [members, setMembers] = useState<RosterMember[]>([]);
  const [showAddRole, setShowAddRole] = useState(false);
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  const [showAddUser, setShowAddUser] = useState(false);
  const [roleForm, setRoleForm] = useState({ name: "", permissions: [] as string[] });
  const [userForm, setUserForm] = useState({ discordId: "", discordName: "", roleIds: [] as string[] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingUserId, setSavingUserId] = useState<string | null>(null);

  // Access editor for an existing admin user: their role checkboxes and any
  // extra permissions granted directly to them, outside of a role.
  const [editingAccessUser, setEditingAccessUser] = useState<AdminUser | null>(null);
  const [accessForm, setAccessForm] = useState({ roleIds: [] as string[], extraPermissions: [] as string[] });

  const fetchData = useCallback(async () => {
    setError(null);
    try {
      const [roleList, userList, sections] = await Promise.all([
        fetchList<AdminRole>("/api/admin/roles"),
        fetchList<AdminUser>("/api/admin/users"),
        fetchList<{ members: RosterMember[] }>("/api/members"),
      ]);
      setRoles(roleList);
      setUsers(userList);
      setMembers(sections.flatMap((s) => s.members ?? []));
    } catch (err) {
      console.error("Failed to fetch:", err);
      setError(errorMessage(err));
      setRoles([]);
      setUsers([]);
      setMembers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Members already carrying an explicit role are managed in the list below;
  // the rest fall back to the default role until one is assigned here.
  const assignedIds = new Set(users.map((u) => u.discordId));
  const linkableMembers = members.filter((m) => m.discordId && !assignedIds.has(m.discordId));
  const unlinkedCount = members.filter((m) => !m.discordId).length;

  const openAddRole = () => {
    setEditingRoleId(null);
    setRoleForm({ name: "", permissions: [] });
    setShowAddRole(true);
  };

  const openEditRole = (role: AdminRole) => {
    setEditingRoleId(role.id);
    setRoleForm({ name: role.name, permissions: [...role.permissions] });
    setShowAddRole(true);
  };

  const handleSaveRole = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingRoleId) {
        await fetchJson("/api/admin/roles", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editingRoleId, ...roleForm }),
        });
        toast.success(`${roleForm.name} updated`);
      } else {
        await fetchJson("/api/admin/roles", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(roleForm),
        });
        toast.success(`${roleForm.name} created`);
      }
      setRoleForm({ name: "", permissions: [] });
      setEditingRoleId(null);
      setShowAddRole(false);
      fetchData();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const user = await fetchJson<AdminUser>("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(userForm),
      });
      toast.success(`${user.discordName} added`);
      setUserForm({ discordId: "", discordName: "", roleIds: [] });
      setShowAddUser(false);
      fetchData();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const handleDeleteRole = async (id: string) => {
    await fetch(`/api/admin/roles?id=${id}`, { method: "DELETE" });
    fetchData();
  };

  const handleDeleteUser = async (id: string) => {
    await fetch(`/api/admin/users?id=${id}`, { method: "DELETE" });
    fetchData();
  };

  const openEditAccess = (user: AdminUser) => {
    setEditingAccessUser(user);
    setAccessForm({
      roleIds: user.roles.map((r) => r.id),
      extraPermissions: [...user.extraPermissions],
    });
  };

  const handleSaveAccess = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAccessUser) return;
    setSavingUserId(editingAccessUser.id);
    try {
      const updated = await fetchJson<AdminUser>("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editingAccessUser.id, ...accessForm }),
      });
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
      toast.success(`${updated.discordName}'s access updated`);
      setEditingAccessUser(null);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSavingUserId(null);
    }
  };

  const summarizeAccess = (user: AdminUser) => {
    const roleNames = user.roles.map((r) => r.name);
    const base = roleNames.length ? roleNames.join(", ") : "EMS Member (default)";
    return user.extraPermissions.length > 0 ? `${base} +${user.extraPermissions.length} extra` : base;
  };

  return (
    <div>
      <h1 className="font-[family-name:var(--font-oswald)] text-2xl font-bold text-white uppercase mb-8">
        Roles & Admin Users
      </h1>

      {loading ? (
        <div className="text-center py-16 text-gray-500">Loading...</div>
      ) : error ? (
        <ErrorState title="Failed to load roles" message={error} onRetry={fetchData} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-[family-name:var(--font-oswald)] text-lg font-semibold text-white uppercase">Roles</h2>
              <Button size="sm" onClick={openAddRole}>Add Role</Button>
            </div>
            <div className="space-y-2">
              {roles.map((r) => (
                <div key={r.id} className="p-3 bg-card border border-[#1e1e1e] rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-white font-medium text-sm">{r.name}</span>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button size="sm" variant="ghost" className="h-6 text-xs text-gray-400" onClick={() => openEditRole(r)}>Edit</Button>
                      <Button size="sm" variant="ghost" className="h-6 text-xs text-red-400" onClick={() => handleDeleteRole(r.id)}>×</Button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {r.permissions.length === 0 ? (
                      <span className="text-xs text-gray-600">No permissions</span>
                    ) : (
                      r.permissions.map((p) => (
                        <span key={p} className="text-xs bg-white/5 text-gray-400 px-1.5 py-0.5 rounded">{p}</span>
                      ))
                    )}
                  </div>
                </div>
              ))}
              {roles.length === 0 && <p className="text-gray-600 text-sm">No roles defined</p>}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-[family-name:var(--font-oswald)] text-lg font-semibold text-white uppercase">Admin Users</h2>
              <Button size="sm" onClick={() => setShowAddUser(true)}>Add User</Button>
            </div>
            <div className="space-y-2">
              {users.map((u) => (
                <div key={u.id} className="flex items-center justify-between gap-3 p-3 bg-card border border-[#1e1e1e] rounded-lg">
                  <div className="min-w-0">
                    <div className="text-white font-medium text-sm truncate">{u.discordName}</div>
                    <div className="text-gray-500 text-xs truncate">{u.discordId}</div>
                    <div className="text-gray-400 text-xs truncate mt-0.5">{summarizeAccess(u)}</div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 text-xs text-gray-400"
                      onClick={() => openEditAccess(u)}
                      disabled={savingUserId === u.id}
                    >
                      Edit Access
                    </Button>
                    <Button size="sm" variant="ghost" className="h-6 text-xs text-red-400" onClick={() => handleDeleteUser(u.id)}>×</Button>
                  </div>
                </div>
              ))}
              {users.length === 0 && <p className="text-gray-600 text-sm">No admin users</p>}
            </div>
          </div>
        </div>
      )}

      <Dialog
        open={showAddRole}
        onOpenChange={(open) => {
          setShowAddRole(open);
          if (!open) setEditingRoleId(null);
        }}
      >
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingRoleId ? "Edit Role" : "Add Role"}</DialogTitle></DialogHeader>
          <form onSubmit={handleSaveRole} className="space-y-4">
            <div><Label>Role Name</Label><Input value={roleForm.name} onChange={(e) => setRoleForm((p) => ({ ...p, name: e.target.value }))} required /></div>
            <div>
              <Label className="mb-2 block">Permissions</Label>
              <PermissionChecklist
                selected={roleForm.permissions}
                onToggle={(p, checked) =>
                  setRoleForm((prev) => ({
                    ...prev,
                    permissions: checked ? [...prev.permissions, p] : prev.permissions.filter((x) => x !== p),
                  }))
                }
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setShowAddRole(false);
                  setEditingRoleId(null);
                }}
              >
                Cancel
              </Button>
              <Button type="submit">{editingRoleId ? "Save" : "Add"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={showAddUser} onOpenChange={setShowAddUser}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Add Admin User</DialogTitle></DialogHeader>
          <form onSubmit={handleAddUser} className="space-y-4">
            <div>
              <Label>Roster Member</Label>
              <select
                value={userForm.discordId}
                onChange={(e) => {
                  const m = linkableMembers.find((x) => x.discordId === e.target.value);
                  setUserForm((p) => ({
                    ...p,
                    discordId: e.target.value,
                    discordName: m ? memberDisplayLabel(m) : "",
                  }));
                }}
                className="flex h-9 w-full rounded-md border border-[#1e1e1e] bg-[#111111] px-3 py-1 text-sm text-white"
                required
              >
                <option value="">Select a member</option>
                {linkableMembers.map((m) => (
                  <option key={m.id} value={m.discordId!}>
                    {m.name} {m.callSign ? `(${m.callSign})` : ""} — {m.rank}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Only members with a Discord ID on their roster entry can sign in.
                {unlinkedCount > 0 && ` ${unlinkedCount} member${unlinkedCount === 1 ? " has" : "s have"} none set.`}
              </p>
            </div>
            <div>
              <Label className="mb-2 block">Roles</Label>
              <p className="text-xs text-gray-500 mb-2">
                Leave all unchecked for the default role. A member can hold more than one.
              </p>
              <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                {roles.map((r) => (
                  <label key={r.id} className="flex items-center gap-2 text-xs text-gray-300">
                    <input
                      type="checkbox"
                      checked={userForm.roleIds.includes(r.id)}
                      onChange={(e) =>
                        setUserForm((prev) => ({
                          ...prev,
                          roleIds: e.target.checked
                            ? [...prev.roleIds, r.id]
                            : prev.roleIds.filter((id) => id !== r.id),
                        }))
                      }
                    />
                    {r.name}
                  </label>
                ))}
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setShowAddUser(false)}>Cancel</Button>
              <Button type="submit">Add</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingAccessUser} onOpenChange={(open) => !open && setEditingAccessUser(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit Access — {editingAccessUser?.discordName}</DialogTitle></DialogHeader>
          <form onSubmit={handleSaveAccess} className="space-y-5">
            <div>
              <Label className="mb-2 block">Roles</Label>
              <p className="text-xs text-gray-500 mb-2">
                A person can hold more than one role — their permissions are the union of all of them.
              </p>
              <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                {roles.map((r) => (
                  <label key={r.id} className="flex items-center gap-2 text-xs text-gray-300">
                    <input
                      type="checkbox"
                      checked={accessForm.roleIds.includes(r.id)}
                      onChange={(e) =>
                        setAccessForm((prev) => ({
                          ...prev,
                          roleIds: e.target.checked
                            ? [...prev.roleIds, r.id]
                            : prev.roleIds.filter((id) => id !== r.id),
                        }))
                      }
                    />
                    {r.name}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <Label className="mb-2 block">Extra Permissions</Label>
              <p className="text-xs text-gray-500 mb-2">
                Granted directly to this person on top of their role(s) — for a one-off case that
                doesn&apos;t justify a whole new role. Adds access only; it can never remove a
                permission a role already grants.
              </p>
              <PermissionChecklist
                selected={accessForm.extraPermissions}
                onToggle={(p, checked) =>
                  setAccessForm((prev) => ({
                    ...prev,
                    extraPermissions: checked
                      ? [...prev.extraPermissions, p]
                      : prev.extraPermissions.filter((x) => x !== p),
                  }))
                }
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setEditingAccessUser(null)}>Cancel</Button>
              <Button type="submit" disabled={savingUserId === editingAccessUser?.id}>Save</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
