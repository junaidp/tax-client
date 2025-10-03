import Link from "next/link";

export function StepLayout({
  title,
  children,
  backHref,
  next,
}: {
  title: string;
  children: React.ReactNode;
  backHref?: string;
  next?: React.ReactNode;
}) {
  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">{title}</h2>
      <div className="mb-6">{children}</div>
      <div className="flex items-center justify-between">
        {backHref ? (
          <Link href={backHref} className="text-sm text-gray-600 hover:text-gray-900">Back</Link>
        ) : <span />}
        {next}
      </div>
    </div>
  );
}
