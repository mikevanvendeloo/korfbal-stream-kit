import React from 'react';
import {Link, Navigate, NavLink, useLocation, useNavigate, useParams} from 'react-router-dom';
import {MdMenuBook, MdSearch} from 'react-icons/md';
import {ManualPart, manualChapters, renderManual, searchManual} from './manual';

const PARTS: Record<ManualPart, { title: string; base: string; other: { label: string; to: string } }> = {
  live: {
    title: 'Handleiding LIVE',
    base: '/handleiding',
    other: {label: 'Handleiding Beheer', to: '/admin/handleiding'},
  },
  beheer: {
    title: 'Handleiding Beheer',
    base: '/admin/handleiding',
    other: {label: 'Handleiding LIVE', to: '/handleiding'},
  },
};

/** One part of the manual: chapters on the left, the chosen chapter on the right. */
export default function ManualView({part}: { part: ManualPart }) {
  const {chapter: slug} = useParams<{ chapter?: string }>();
  const {hash} = useLocation();
  const navigate = useNavigate();
  const [query, setQuery] = React.useState('');
  const contentRef = React.useRef<HTMLDivElement>(null);
  const {title, base, other} = PARTS[part];

  const chapters = manualChapters(part);
  const chapter = chapters.find((c) => c.slug === slug);
  const html = React.useMemo(() => (chapter ? renderManual(chapter.markdown) : ''), [chapter]);
  const hits = query.trim() ? searchManual(part, query) : null;

  // Scroll to the section the help button pointed at, or to the top for a new chapter
  React.useEffect(() => {
    const target = hash ? document.getElementById(decodeURIComponent(hash.slice(1))) : null;
    if (target) target.scrollIntoView?.({block: 'start'});
    else window.scrollTo?.({top: 0});
  }, [slug, hash]);

  if (!chapters.length) return <div className="container py-6">Deze handleiding is nog leeg.</div>;
  // Unknown or no chapter: start at the first one
  if (!chapter) return <Navigate to={`${base}/${chapters[0].slug}`} replace/>;

  // Links in the text to app pages ("/callsheet") stay in the app instead of reloading it
  function onContentClick(e: React.MouseEvent<HTMLDivElement>) {
    const a = (e.target as HTMLElement).closest('a');
    const href = a?.getAttribute('href');
    if (!href || !href.startsWith('/') || e.metaKey || e.ctrlKey) return;
    e.preventDefault();
    navigate(href);
  }

  return (
    <div className="container py-6 text-gray-800 dark:text-gray-100">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 className="text-2xl font-semibold inline-flex items-center gap-2"><MdMenuBook/> {title}</h1>
        <Link to={other.to} className="text-sm text-blue-600 dark:text-blue-400 hover:underline">{other.label} →</Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[16rem_1fr] gap-8">
        <aside className="md:sticky md:top-4 self-start">
          <label className="relative block mb-4">
            <span className="sr-only">Zoeken in de handleiding</span>
            <MdSearch className="absolute left-2 top-2.5 text-gray-400"/>
            <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Zoeken…"
                   className="w-full pl-8 pr-2 py-2 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900"/>
          </label>
          <nav aria-label="Hoofdstukken">
            {hits && hits.length === 0 && <p className="text-sm text-gray-500">Niets gevonden.</p>}
            <ol className="space-y-1 text-sm">
              {(hits ?? chapters).map((c) => (
                <li key={c.slug}>
                  <NavLink to={`${base}/${c.slug}`}
                           className={({isActive}) => `block px-2 py-1 rounded ${isActive ? 'bg-blue-50 text-blue-700 font-medium dark:bg-blue-900/30 dark:text-blue-300' : 'hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
                    {c.title}
                  </NavLink>
                  {c.slug === chapter.slug && !hits && c.sections.length > 0 && (
                    <ol className="ml-3 mt-1 mb-2 border-l border-gray-200 dark:border-gray-700 space-y-0.5">
                      {c.sections.map((s) => (
                        <li key={s.id}>
                          <Link to={`${base}/${c.slug}#${s.id}`} className="block pl-3 py-0.5 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100">
                            {s.title}
                          </Link>
                        </li>
                      ))}
                    </ol>
                  )}
                </li>
              ))}
            </ol>
          </nav>
        </aside>

        {/* The manual's own Markdown, bundled with the app: no user input ends up here */}
        <article ref={contentRef} className="manual max-w-3xl" onClick={onContentClick}
                 dangerouslySetInnerHTML={{__html: html}}/>
      </div>
    </div>
  );
}
