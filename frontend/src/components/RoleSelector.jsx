import React from 'react'

export default function RoleSelector({role, onChange}){
  return (
    <div className="flex items-center gap-2">
      <label className="text-sm text-gray-600">Rol:</label>
      <select value={role} onChange={e=>onChange(e.target.value)} className="p-1 border bg-white dark:bg-gray-800">
        <option value="admin">Admin</option>
        <option value="editor">Editor</option>
        <option value="viewer">Viewer</option>
      </select>
    </div>
  )
}
