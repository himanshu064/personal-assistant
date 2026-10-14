import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "cn";

/** react-markdown passes its syntax tree node as a prop; it must not reach the DOM. */
function strip<T extends { node?: unknown }>(props: T): Omit<T, "node"> {
  const rest = { ...props };
  delete rest.node;
  return rest;
}

/** AI replies and project memory: tables, lists, bold and links, styled like the rest of the app. */
const components: Components = {
  p: (props) => <p className="my-3 first:mt-0 last:mb-0" {...strip(props)} />,
  ul: (props) => <ul className="my-3 list-disc space-y-1 pl-5" {...strip(props)} />,
  ol: (props) => <ol className="my-3 list-decimal space-y-1 pl-5" {...strip(props)} />,
  h1: (props) => <h3 className="mt-5 mb-2 text-base font-semibold first:mt-0" {...strip(props)} />,
  h2: (props) => <h3 className="mt-5 mb-2 text-base font-semibold first:mt-0" {...strip(props)} />,
  h3: (props) => <h4 className="mt-4 mb-2 font-semibold first:mt-0" {...strip(props)} />,
  strong: (props) => <strong className="font-semibold" {...strip(props)} />,
  a: (props) => <a className="underline underline-offset-4" target="_blank" rel="noreferrer" {...strip(props)} />,
  code: (props) => <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.9em]" {...strip(props)} />,
  pre: (props) => <pre className="my-3 overflow-x-auto rounded-xl bg-muted p-3 text-sm [&_code]:bg-transparent [&_code]:p-0" {...strip(props)} />,
  blockquote: (props) => <blockquote className="my-3 border-l-2 pl-3 text-muted-foreground" {...strip(props)} />,
  hr: () => <hr className="my-4 border-dashed" />,
  // Tables scroll sideways on phones instead of widening the page.
  table: (props) => (
    <div className="my-3 overflow-x-auto rounded-xl border">
      <table className="w-full border-collapse text-left text-sm" {...strip(props)} />
    </div>
  ),
  thead: (props) => <thead className="bg-muted/60" {...strip(props)} />,
  th: (props) => <th className="border-b px-3 py-2 font-medium" {...strip(props)} />,
  td: (props) => <td className="border-b px-3 py-2 align-top [tr:last-child_&]:border-0" {...strip(props)} />,
};

export function Markdown({ children, className }: { children: string; className?: string }) {
  return (
    <div className={cn("text-[15px] leading-relaxed break-words", className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
