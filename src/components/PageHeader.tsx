interface PageHeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}

export default function PageHeader({ title, subtitle, action }: PageHeaderProps) {
  return (
    <div className="bg-gradient-to-r from-brand-900 to-brand-700">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-8">
        <div>
          <h1 className="text-2xl font-bold text-white">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-slate-300">{subtitle}</p>}
        </div>
        {action}
      </div>
    </div>
  );
}