import * as React from 'react';
import {useMemo} from 'react';
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
} from '@tanstack/react-table';
import {Sponsor} from '../lib/api';
import IconButton from './IconButton';
import { MdDelete, MdEdit } from 'react-icons/md';

export type SponsorsTableProps = {
  data: Sponsor[];
  onEdit?: (s: Sponsor) => void;
  onDelete?: (s: Sponsor) => void;
};

export function SponsorsTable({ data, onEdit, onDelete }: SponsorsTableProps) {
  const columns = useMemo<ColumnDef<Sponsor>[]>(
    () => [
      {
        accessorKey: 'name',
        header: () => 'Naam',
        cell: (info) => info.getValue() as string,
      },
      {
        accessorKey: 'type',
        header: () => 'Type',
        cell: (info) => String(info.getValue()),
      },
      {
        accessorKey: 'websiteUrl',
        header: () => 'Website',
        cell: (info) => (
          <a className="text-blue-600 dark:text-blue-400 underline" href={String(info.getValue())} target="_blank" rel="noreferrer">
            {String(info.getValue())}
          </a>
        ),
      },
      {
        accessorKey: 'logoUrl',
        header: () => 'Logo',
        cell: (info) => (
          <div className="flex items-center gap-2">
            <img src={`/uploads/sponsors/${info.getValue()}`} alt={String(info.row.original.name)} className="h-8 w-8 object-contain" onError={(e) => ((e.currentTarget.style.visibility = 'hidden'))} />
            <span className="text-xs text-gray-500 dark:text-gray-400">{String(info.getValue())}</span>
          </div>
        ),
      },
      {
        header: () => 'Acties',
        id: 'actions',
        cell: (info) => (
          <div className="flex gap-2">
            {onEdit && (
              <IconButton ariaLabel="Edit sponsor" title="Wijzig" onClick={() => onEdit(info.row.original)}>
                <MdEdit className="w-5 h-5" />
              </IconButton>
            )}
            {onDelete && (
              <IconButton ariaLabel="Delete sponsor" title="Verwijder" onClick={() => onDelete(info.row.original)}>
                <MdDelete className="w-5 h-5 text-red-600" />
              </IconButton>
            )}
          </div>
        ),
      },
    ],
    [onEdit, onDelete]
  );

  const [sorting, setSorting] = React.useState<SortingState>([{ id: 'name', desc: false }]);

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div>
      {/* Mobile cards */}
      <div className="md:hidden card-list">
        {table.getRowModel().rows.map((row) => (
          <div key={row.id} className="card">
            <div className="flex items-center gap-3">
              <img src={`/uploads/sponsors/${row.original.logoUrl}`} alt={row.original.name} className="h-10 w-10 object-contain" onError={(e) => ((e.currentTarget.style.visibility = 'hidden'))} />
              <div className="flex-1">
                <div className="font-semibold">{row.original.name}</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">{row.original.type}</div>
              </div>
              <div className="flex gap-2">
                {onEdit && (
                  <IconButton ariaLabel="Edit sponsor" title="Wijzig" onClick={() => onEdit(row.original)}>
                    <MdEdit className="w-5 h-5" />
                  </IconButton>
                )}
                {onDelete && (
                  <IconButton ariaLabel="Delete sponsor" title="Verwijder" onClick={() => onDelete(row.original)}>
                    <MdDelete className="w-5 h-5 text-red-600" />
                  </IconButton>
                )}
              </div>
            </div>
            <div className="mt-2">
              <div className="label">Website</div>
              <a className="value text-blue-600 dark:text-blue-400 underline" href={row.original.websiteUrl} target="_blank" rel="noreferrer">
                {row.original.websiteUrl}
              </a>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="table">
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((h) => (
                  <th key={h.id} onClick={h.column.getToggleSortingHandler()} className="select-none cursor-pointer">
                    <div className="flex items-center gap-1">
                      {flexRender(h.column.columnDef.header, h.getContext())}
                      {{ asc: '▲', desc: '▼' }[h.column.getIsSorted() as string] ?? null}
                    </div>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

