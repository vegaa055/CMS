import { Search, SearchX, UsersRound } from "lucide-react";
import Form from "next/form";
import Link from "next/link";

import { EmptyState } from "@/components/admin/empty-state";
import { UserAvatar } from "@/components/admin/user-avatar";
import { RemoveUser, RoleSelect } from "@/components/admin/users/user-controls";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate } from "@/lib/format";
import type { ReaderRow } from "@/lib/queries/admin";

const BASE = "/admin/users/readers";

/**
 * Readers can number in the thousands, so unlike the team table this pages
 * and searches on the server (?q=&page=).
 */
export function ReadersTable({
  rows,
  total,
  page,
  pageCount,
  query,
  signupEnabled,
}: {
  rows: ReaderRow[];
  total: number;
  page: number;
  pageCount: number;
  query: string;
  signupEnabled: boolean;
}) {
  const pageHref = (n: number) => {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (n > 1) params.set("page", String(n));
    const search = params.toString();
    return search ? `${BASE}?${search}` : BASE;
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Form action={BASE} role="search" className="flex items-center gap-2">
          <div className="relative w-full sm:w-xs">
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
            <Input
              name="q"
              type="search"
              defaultValue={query}
              placeholder="Search readers…"
              aria-label="Search readers by name or email"
              className="pl-8"
            />
          </div>
          {query && (
            <Button variant="ghost" size="sm" asChild>
              <Link href={BASE}>Clear</Link>
            </Button>
          )}
        </Form>
        <p className="text-muted-foreground ml-auto text-sm">
          Reader sign-up is{" "}
          <strong className="text-foreground">
            {signupEnabled ? "on" : "off"}
          </strong>
          .{" "}
          <Link
            href="/admin/settings"
            className="text-foreground underline-offset-4 hover:underline"
          >
            Change
          </Link>
        </p>
      </div>

      {rows.length === 0 ? (
        query ? (
          <EmptyState
            icon={SearchX}
            title="No matching readers"
            description={`No reader's name or email contains “${query}”.`}
          />
        ) : (
          <EmptyState
            icon={UsersRound}
            title="No readers yet"
            description={
              signupEnabled
                ? "People who create an account at /register show up here."
                : "Turn on reader sign-up in Settings to let people create accounts."
            }
          />
        )
      ) : (
        <div className="bg-card overflow-hidden rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Reader</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((reader) => (
                <TableRow key={reader.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <UserAvatar
                        name={reader.name}
                        image={reader.image}
                        className="size-8"
                      />
                      <div className="flex flex-col">
                        <span className="flex items-center gap-2 font-medium">
                          {reader.name}
                          {!reader.emailVerified && (
                            <Badge variant="outline">Unverified</Badge>
                          )}
                        </span>
                        <span className="text-muted-foreground text-xs">
                          {reader.email}
                        </span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(reader.createdAt)}
                  </TableCell>
                  <TableCell>
                    <RoleSelect user={reader} />
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end">
                      <RemoveUser user={reader} />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {pageCount > 1 && (
        <nav
          aria-label="Pagination"
          className="text-muted-foreground flex items-center justify-between gap-2 text-sm"
        >
          <span>
            Page {page} of {pageCount} · {total} readers
          </span>
          <div className="flex gap-2">
            {page > 1 ? (
              <Button variant="outline" size="sm" asChild>
                <Link href={pageHref(page - 1)} rel="prev">
                  Previous
                </Link>
              </Button>
            ) : (
              <Button variant="outline" size="sm" disabled>
                Previous
              </Button>
            )}
            {page < pageCount ? (
              <Button variant="outline" size="sm" asChild>
                <Link href={pageHref(page + 1)} rel="next">
                  Next
                </Link>
              </Button>
            ) : (
              <Button variant="outline" size="sm" disabled>
                Next
              </Button>
            )}
          </div>
        </nav>
      )}
    </div>
  );
}
