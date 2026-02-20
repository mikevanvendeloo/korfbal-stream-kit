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
import {MdDelete, MdEdit} from 'react-icons/md';
import {RiVipCrown2Fill} from 'react-icons/ri';
import {FaMedal} from 'react-icons/fa';

export type SponsorsTableProps = {
  data: Sponsor[];
  onEdit?: (s: Sponsor) => void;
  onDelete?: (s: Sponsor) => void;
};

export function SponsorsTable({ data, onEdit, onDelete }: SponsorsTableProps) {
  const typeIcon = (type: string) => {
    switch (type) {
      case 'premium':
        return <RiVipCrown2Fill className="w-5 h-5 inline-block" style={{ color: '#7c3aed' }} title="Premium" />;
      case 'goud':
        return <FaMedal className="w-5 h-5 inline-block" style={{ color: '#d4af37' }} title="Goud" />;
      case 'zilver':
        return <FaMedal className="w-5 h-5 inline-block" style={{ color: '#9ca3af' }} title="Zilver" />;
      case 'brons':
        return <FaMedal className="w-5 h-5 inline-block" style={{ color: '#cd7f32' }} title="Brons" />;
      default:
        return null;
    }
  };

  const columns = useMemo<ColumnDef<Sponsor>[]>(
    () => [
      {
        accessorKey: 'name',
        header: 'Naam',
        cell: (info) => <span className="font-medium text-gray-900 dark:text-gray-100 truncate block max-w-[200px]" title={info.getValue() as string}>{info.getValue() as string}</span>,
      },
      {
        accessorKey: 'displayName',
        header: 'Weergavenaam',
        cell: (info) => {
          const dn = (info.getValue() as string | null | undefined) || '';
          return dn ? <span className="text-sm text-gray-600 dark:text-gray-400 truncate block max-w-[150px]" title={dn}>{dn}</span> : <span className="text-xs text-gray-400">—</span>;
        },
      },
      {
        accessorKey: 'type',
        header: 'Type',
        cell: (info) => (
          <div className="flex items-center gap-2">
            {typeIcon(String(info.getValue()))}
            <span className="capitalize">{String(info.getValue())}</span>
          </div>
        ),
        sortingFn: (rowA, rowB) => {
          const typeOrder: Record<string, number> = { premium: 0, goud: 1, zilver: 2, brons: 3 };
          const a = typeOrder[rowA.original.type] ?? 999;
          const b = typeOrder[rowB.original.type] ?? 999;
          return a - b;
        },
      },
      {
        accessorKey: 'logoUrl',
        header: 'Logo',
        cell: (info) => (
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 flex-shrink-0 bg-gray-50 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 flex items-center justify-center overflow-hidden">
                <img src={`/uploads/sponsors/${info.getValue()}`} alt={String(info.row.original.name)} className="max-h-full max-w-full object-contain" onError={(e) => ((e.currentTarget.style.visibility = 'hidden'))} />
            </div>
            <span className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[150px] hidden sm:inline-block" title={String(info.getValue())}>{String(info.getValue())}</span>
          </div>
        ),
      },
      {
        header: 'Acties',
        id: 'actions',
        cell: (info) => (
          <div className="flex gap-2 justify-end">
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

  // Default sorting removed (empty array) so it respects the API order (which is by type priority)
  const [sorting, setSorting] = React.useState<SortingState>([]);

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
      <div className="md:hidden flex flex-col gap-4">
        {table.getRowModel().rows.map((row) => (
          <div key={row.id} className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow border border-gray-200 dark:border-gray-700">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 overflow-hidden">
                <div className="h-12 w-12 flex-shrink-0 bg-gray-50 dark:bg-gray-900 rounded p-1 border border-gray-100 dark:border-gray-700 flex items-center justify-center">
                    <img src={`/uploads/sponsors/${row.original.logoUrl}`} alt={row.original.name} className="max-h-full max-w-full object-contain" onError={(e) => ((e.currentTarget.style.visibility = 'hidden'))} />
                </div>
                <div className="min-w-0">
                  <div className="font-semibold text-gray-900 dark:text-gray-100 truncate">{row.original.name}</div>
                  <div className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                    {typeIcon(row.original.type)}
                    <span className="capitalize">{row.original.type}</span>
                  </div>
                </div>
              </div>
              <div className="flex gap-1 flex-shrink-0">
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

            {(row.original as any).displayName && (
               <div className="mt-2 text-xs text-gray-500 dark:text-gray-400 truncate">
                 Weergave: <span className="text-gray-700 dark:text-gray-300">{(row.original as any).displayName}</span>
               </div>
            )}
          </div>
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
        <table className="w-full text-left text-sm text-gray-500 dark:text-gray-400">
          <thead className="bg-gray-50 dark:bg-gray-800 text-xs uppercase text-gray-700 dark:text-gray-300">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((h) => (
                  <th key={h.id} onClick={h.column.getToggleSortingHandler()} className="px-4 py-3 select-none cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors first:pl-6 last:pr-6">
                    <div className="flex items-center gap-1">
                      {flexRender(h.column.columnDef.header, h.getContext())}
                      {{ asc: ' ▲', desc: ' ▼' }[h.column.getIsSorted() as string] ?? null}
                    </div>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-900">
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-4 py-3 whitespace-nowrap first:pl-6 last:pr-6">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
