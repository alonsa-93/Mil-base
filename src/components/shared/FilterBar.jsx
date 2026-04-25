export default function FilterBar({ search, onSearch, filters = [], extra }) {
  return (
    <div className="flex flex-wrap gap-3 items-center">
      {onSearch !== undefined && (
        <div className="relative flex-1 min-w-[200px]">
          <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
          </svg>
          <input className="input pr-9 text-sm" placeholder="חיפוש..." value={search} onChange={e => onSearch(e.target.value)} />
        </div>
      )}
      {filters.map(f => (
        <select key={f.key} className="select text-sm w-auto min-w-[130px]" value={f.value} onChange={e => f.onChange(e.target.value)}>
          <option value="">{f.label} — הכל</option>
          {f.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      ))}
      {extra}
    </div>
  );
}
