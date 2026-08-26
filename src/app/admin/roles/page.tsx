"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ALL_PERMISSIONS } from "@/lib/constants";
import { DEFAULT_MEMBER_ROLE } from "@/lib/role-presets";
import { ErrorState } from "@/components/ui/error-state";
import { fetchJson, fetchList, errorMessage } from "@/lib/fetch-json";
import { toast } from "sonner";

interface AdminRole { id: string; name: string; permissions: string[]; }
interface AdminUser { id: string; discordId: string; discordName: string; roleId?: string | null; role?: AdminRole | null; }
interface RosterMember { id: string; name: string; callSign?: string | null; rank: string; discordId?: string | null; }

export default function AdminRolesPage() {
  const [roles, setRoles] = useState<AdminRole[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [members, setMembers] = useState<RosterMember[]>([]);
  const [showAddRole, setShowAddRole] = useState(false);
  const [showAddUser, setShowAddUser] = useState(false);
  const [roleForm, setRoleForm] = useState({ name: "", permissions: [] as string[] });
  const [userForm, setUserForm] = useState({ discordId: "", discordName: "", roleId: "" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingUserId, setSavingUserId] = useState<string | null>(null);

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

  const handleAddRole = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch("/api/admin/roles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(roleForm),
    });
    setRoleForm({ name: "", permissions: [] });
    setShowAddRole(false);
    fetchData();
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await fetchJson("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // roleId is a foreign key — "" is not a valid AdminRole.id, so the
        // unset "default role" option must send null, not the raw "" value.
        body: JSON.stringify({ ...userForm, roleId: userForm.roleId || null }),
      });
      toast.success(`${userForm.discordName} added`);
      setUserForm({ discordId: "", discordName: "", roleId: "" });
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

  const handleChangeUserRole = async (user: AdminUser, roleId: string) => {
    // roleId === "" means "no explicit role" — the user falls back to the
    // default role at session time rather than storing a role of its own.
    const nextRoleId = roleId || null;
    if ((user.roleId ?? null) === nextRoleId) return;

    const previous = users;
    const nextRole = roles.find((r) => r.id === nextRoleId) ?? null;
    setUsers((prev) =>
      prev.map((u) => (u.id === user.id ? { ...u, roleId: nextRoleId, role: nextRole } : u))
    );
    setSavingUserId(user.id);

    try {
      await fetchJson("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: user.id, roleId: nextRoleId }),
      });
      toast.success(`${user.discordName} is now ${nextRole?.name ?? DEFAULT_MEMBER_ROLE}`);
    } catch (err) {
      setUsers(previous);
      toast.error(errorMessage(err));
    } finally {
      setSavingUserId(null);
    }
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
              <Button size="sm" onClick={() => setShowAddRole(true)}>Add Role</Button>
            </div>
            <div className="space-y-2">
              {roles.map((r) => (
                <div key={r.id} className="p-3 bg-card border border-[#1e1e1e] rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-white font-medium text-sm">{r.name}</span>
                    <Button size="sm" variant="ghost" className="h-6 text-xs text-red-400" onClick={() => handleDeleteRole(r.id)}>×</Button>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {r.permissions.map((p) => (
                      <span key={p} className="text-xs bg-white/5 text-gray-400 px-1.5 py-0.5 rounded">{p}</span>
                    ))}
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
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <select
                      value={u.roleId ?? ""}
                      onChange={(e) => handleChangeUserRole(u, e.target.value)}
                      disabled={savingUserId === u.id}
                      className="h-8 rounded-md border border-[#1e1e1e] bg-[#111111] px-2 text-xs text-white disabled:opacity-50"
                    >
                      <option value="">{DEFAULT_MEMBER_ROLE} (default)</option>
                      {roles.map((r) => (
                        <option key={r.id} value={r.id}>{r.name}</option>
                      ))}
                    </select>
                    <Button size="sm" variant="ghost" className="h-6 text-xs text-red-400" onClick={() => handleDeleteUser(u.id)}>×</Button>
                  </div>
                </div>
              ))}
              {users.length === 0 && <p className="text-gray-600 text-sm">No admin users</p>}
            </div>
          </div>
        </div>
      )}

      <Dialog open={showAddRole} onOpenChange={setShowAddRole}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Add Role</DialogTitle></DialogHeader>
          <form onSubmit={handleAddRole} className="space-y-4">
            <div><Label>Role Name</Label><Input value={roleForm.name} onChange={(e) => setRoleForm((p) => ({ ...p, name: e.target.value }))} required /></div>
            <div>
              <Label className="mb-2 block">Permissions</Label>
              <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto">
                {ALL_PERMISSIONS.map((p) => (
                  <label key={p} className="flex items-center gap-2 text-xs text-gray-300">
                    <input
                      type="checkbox"
                      checked={roleForm.permissions.includes(p)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setRoleForm((prev) => ({ ...prev, permissions: [...prev.permissions, p] }));
                        } else {
                          setRoleForm((prev) => ({ ...prev, permissions: prev.permissions.filter((x) => x !== p) }));
                        }
                      }}
                    />
                    {p}
                  </label>
                ))}
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setShowAddRole(false)}>Cancel</Button>
              <Button type="submit">Add</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={showAddUser} onOpenChange={setShowAddUser}>
        <DialogContent>
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
                    discordName: m ? `${m.name}${m.callSign ? ` (${m.callSign})` : ""}` : "",
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
              <Label>Role</Label>
              <select
                value={userForm.roleId}
                onChange={(e) => setUserForm((p) => ({ ...p, roleId: e.target.value }))}
                className="flex h-9 w-full rounded-md border border-[#1e1e1e] bg-[#111111] px-3 py-1 text-sm text-white"
              >
                <option value="">{DEFAULT_MEMBER_ROLE} (default)</option>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setShowAddUser(false)}>Cancel</Button>
              <Button type="submit">Add</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
