import * as React from "react";
import { cn } from "../../lib/utils";

function Table({ className, ...props }: React.TableHTMLAttributes<HTMLTableElement>) {
  return (
    <table className={cn("min-w-full text-sm border border-gray-700 rounded text-gray-100", className)} {...props} />
  );
}

function THead({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn("bg-[#2B323B]", className)} {...props} />;
}

function TBody({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn("", className)} {...props} />;
}

function TR({ className, ...props }: React.HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={cn("border-t border-gray-700", className)} {...props} />;
}

function TH({ className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return <th className={cn("py-2 px-3 text-left", className)} {...props} />;
}

function TD({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn("px-3 py-2", className)} {...props} />;
}

// Shadcn-compatible aliases
function TableHeader(props: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn("bg-[#2B323B]", props.className)} {...props} />;
}
function TableBody(props: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn("", props.className)} {...props} />;
}
function TableRow(props: React.HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={cn("border-t border-gray-700 transition-colors hover:bg-muted/50", props.className)} {...props} />;
}
function TableHead(props: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return <th className={cn("h-12 px-4 text-left align-middle font-medium text-muted-foreground", props.className)} {...props} />;
}
function TableCell(props: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn("p-4 align-middle [&:has([role=checkbox])]:pr-0", props.className)} {...props} />;
}
function TableFooter(props: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <tfoot className={cn("border-t bg-muted/50 font-medium [&_tr]:last:border-b-0", props.className)} {...props} />;
}
function TableCaption(props: React.HTMLAttributes<HTMLTableCaptionElement>) {
  return <caption className={cn("mt-4 text-sm text-muted-foreground", props.className)} {...props} />;
}

export {
  Table,
  THead, TBody, TR, TH, TD,
  TableHeader, TableBody, TableRow, TableHead, TableCell, TableFooter, TableCaption
};