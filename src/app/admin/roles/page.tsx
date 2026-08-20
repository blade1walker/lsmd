"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ALL_PERMISSIONS } from "@/lib/constants";

interface AdminRole { id: string; name: string; permissions: string[]; }
interface AdminUser { id: string; discordId: string; discordName: string; roleId?: string | null; role?: AdminRole | null; }

export default function AdminRolesPage() {
  const [roles, setRoles] = useState<AdminRole[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [showAddRole, setShowAddRole] = useState(false);
  const [showAddUser, setShowAddUser] = useState(false);
  const [roleForm, setRoleForm] = useState({ name: "", permissions: [] as string[] });
  const [userForm, setUserForm] = useState({ discordId: "", discordName: "", roleId: "" });
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [rolesRes, usersRes] = await Promise.all([
        fetch("/api/admin/roles"),
        fetch("/api/admin/users"),
      ]);
      setRoles(await rolesRes.json());
      setUsers(await usersRes.json());
    } catch (err) {
      console.error("Failed to fetch:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

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
    await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(userForm),
    });
    setUserForm({ discordId: "", discordName: "", roleId: "" });
    setShowAddUser(false);
    fetchData();
  };

  const handleDeleteRole = async (id: string) => {
    await fetch(`/api/admin/roles?id=${id}`, { method: "DELETE" });
    fetchData();
  };

  const handleDeleteUser = async (id: string) => {
    await fetch(`/api/admin/users?id=${id}`, { method: "DELETE" });
    fetchData();
  };

  return (
    <div>
      <h1 className="font-[family-name:var(--font-oswald)] text-2xl font-bold text-white uppercase mb-8">
        Roles & Admin Users
      </h1>

      {loading ? (
        <div className="text-center py-16 text-gray-500">Loading...</div>
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
                <div key={u.id} className="flex items-center justify-between p-3 bg-card border border-[#1e1e1e] rounded-lg">
                  <div>
                    <span className="text-white font-medium text-sm">{u.discordName}</span>
                    <span className="text-gray-500 text-xs ml-2">{u.discordId}</span>
                    {u.role && <span className="text-gold text-xs ml-2">({u.role.name})</span>}
                  </div>
                  <Button size="sm" variant="ghost" className="h-6 text-xs text-red-400" onClick={() => handleDeleteUser(u.id)}>×</Button>
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
            <div><Label>Discord ID</Label><Input value={userForm.discordId} onChange={(e) => setUserForm((p) => ({ ...p, discordId: e.target.value }))} required /></div>
            <div><Label>Discord Name</Label><Input value={userForm.discordName} onChange={(e) => setUserForm((p) => ({ ...p, discordName: e.target.value }))} required /></div>
            <div>
              <Label>Role</Label>
              <select
                value={userForm.roleId}
                onChange={(e) => setUserForm((p) => ({ ...p, roleId: e.target.value }))}
                className="flex h-9 w-full rounded-md border border-[#1e1e1e] bg-[#111111] px-3 py-1 text-sm text-white"
              >
                <option value="">None</option>
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
