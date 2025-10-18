import React from 'react';
import { ColumnDef, flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { Person } from '../hooks/usePersons';
import IconButton from './IconButton';
import { MdDelete, MdEdit, MdManageAccounts } from 'react-icons/md';

export type PersonsTableProps = {
  data: Person[];
  onEdit?: (p: Person) => void;
  onDelete?: (p: Person) => void;
  onManageCapabilities?: (p: Person) => void;
};

export default function PersonsTable({ data, onEdit, onDelete, onManageCapabilities }: PersonsTableProps) {
  const columns = React.useMemo<ColumnDef<Person>[]>(
    () => [
      { header: 'ID', accessorKey: 'id' },
      { header: 'Naam', accessorKey: 'name' },
      { header: 'Geslacht', accessorKey: 'gender' },
      {
        header: 'Aangemaakt',
        accessorKey: 'createdAt',
        cell: (info) => new Date(info.getValue<string>()).toLocaleString(),
      },
      {
        header: 'Acties',
        cell: ({ row }) => (
          <div className="flex gap-2">
            {onManageCapabilities && (
              <IconButton ariaLabel="Manage capabilities" title="Beheer capabilities" onClick={() => onManageCapabilities(row.original)}>
                <MdManageAccounts className="w-5 h-5" />
              </IconButton>
            )}
            {onEdit && (
              <IconButton ariaLabel="Edit person" title="Wijzig" onClick={() => onEdit(row.original)}>
                <MdEdit className="w-5 h-5" />
              </IconButton>
            )}
            {onDelete && (
              <IconButton ariaLabel="Delete person" title="Verwijder" onClick={() => onDelete(row.original)}>
                <MdDelete className="w-5 h-5 text-red-600" />
              </IconButton>
            )}
          </div>
        ),
      },
    ],
    [onEdit, onDelete, onManageCapabilities]
  );

  const table = useReactTable({ data, columns, getCoreRowModel: getCoreRowModel() });

  return (
    <table className="min-w-full border border-gray-200 dark:border-gray-800 text-sm">
      <thead className="bg-gray-50 dark:bg-gray-900">
        {table.getHeaderGroups().map((hg) => (
          <tr key={hg.id}>
            {hg.headers.map((header) => (
              <th key={header.id} className="text-left p-2 border-b border-gray-200 dark:border-gray-800">
                {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
              </th>
            ))}
          </tr>
        ))}
      </thead>
      <tbody>
        {table.getRowModel().rows.map((row) => (
          <tr key={row.id} className="hover:bg-gray-50 dark:hover:bg-gray-900">
            {row.getVisibleCells().map((cell) => (
              <td key={cell.id} className="p-2 border-b border-gray-200 dark:border-gray-800">
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
